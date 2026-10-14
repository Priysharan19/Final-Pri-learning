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
// A review, CI wait, or merge-ready record does not itself occupy a code writer.
const WRITER_STATES = new Set(['ACTIVE','IMPLEMENTING','TESTING','REPAIR']);
const REVIEW_STATES = new Set(['REVIEW','CI','MERGE_READY','REPAIR_PENDING']);
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
  if (control.lease?.admission_mode !== 'serialized_only') errors.push('admission must fail closed without a serialized authority');
  for (const field of ['heartbeat_field','progress_ref_field','heartbeat_agent_field']) if (!control.lease?.[field]) errors.push('missing '+field);
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
  if (WRITER_STATES.has(record.status)) {
    if (!Number.isFinite(Date.parse(record.lease_heartbeat_at))) errors.push('lease_heartbeat_at must be ISO date-time');
    if (!/^[0-9a-f]{40}$/i.test(String(record.lease_heartbeat_ref || ''))) errors.push('lease_heartbeat_ref must be a full commit SHA');
    if (record.lease_heartbeat_by !== record.agent) errors.push('lease_heartbeat_by must match canonical agent');
  }
  if (record.failure_fingerprint && !/^[0-9a-f]{64}$/i.test(record.failure_fingerprint)) errors.push('failure_fingerprint must be sha256');
  return errors;
}

function transition(record, next) {
  const errors = validateRecord(record);
  // Existing pre-heartbeat writer records must still be RELEASABLE. Allow
  // migration out of a writer state while ignoring ONLY missing/invalid
  // heartbeat fields; never use this waiver to enter or retain code writing.
  const releasing = WRITER_STATES.has(record.status) && !WRITER_STATES.has(next);
  const material = releasing ? errors.filter(e => !/^lease_heartbeat_(at|ref|by) /.test(e)) : errors;
  if (material.length) throw new Error(`invalid record: ${material.join('; ')}`);
  // State-machine transitions are not admission. A writer must be granted
  // through the separate authoritative serialized controller.
  if (WRITER_STATES.has(next) && !WRITER_STATES.has(record.status))
    throw new Error('SERIALIZED_ADMISSION_REQUIRED: cannot acquire a writer lease with transition');
  if (WRITER_STATES.has(next))
    throw new Error('SIGNED_SERIALIZED_GOVERNOR_LEASE_REQUIRED: transition cannot prove writer renewal');
  const allowed = control.transitions[record.status] || [];
  if (!allowed.includes(next)) throw new Error(`transition ${record.status} -> ${next} is not allowed`);
  // A transition never fabricates progress or extends the writer lease.
  const out = { ...record, status: next, updated_at: new Date().toISOString() };
  if (WRITER_STATES.has(next) && !WRITER_STATES.has(record.status)) {
    // Re-entering active work requires a separately admitted new heartbeat.
    delete out.lease_heartbeat_at; delete out.lease_heartbeat_ref; delete out.lease_heartbeat_by;
  }
  return out;
}

function normalizedFingerprint(text) {
  const normalized = String(text).replace(/\r/g, '').replace(/\b\d+(?:\.\d+)?s\b/g, '<duration>').replace(/\b\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?\b/g, '<timestamp>').replace(/[ \t]+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function freshness(heartbeatAt, now = Date.now()) {
  const stamped = Date.parse(heartbeatAt);
  const ageMs = now - stamped;
  const ttlMs = Number(control.lease.ttl_hours) * 60 * 60 * 1000;
  const valid = Number.isFinite(stamped) && Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= ttlMs;
  return { valid, age_minutes: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null, ttl_minutes: control.lease.ttl_hours * 60, reason: valid ? 'explicit progress lease active' : 'missing, future or expired progress heartbeat' };
}

function leaseStatus(record, now = Date.now()) {
  if (!WRITER_STATES.has(record.status)) return { valid: false, reason: `state ${record.status} does not hold a code-writer lease` };
  const errors = validateRecord(record);
  if (errors.length) return { valid: false, reason: `invalid record: ${errors.join('; ')}` };
  // Editable heartbeats are audit metadata, not a signed governor grant.
  return {valid:false,reason:'SIGNED_SERIALIZED_GOVERNOR_LEASE_REQUIRED',heartbeat_structurally_valid:true};
}

function markerValues(body, key) {
  // Do not let whitespace span lines or repeated values acquire authority.
  const rx = new RegExp('^' + key + ':[ \t]*(.*)$', 'gmi');
  return [...String(body || '').matchAll(rx)].map(match => match[1].trim());
}

function marker(body, key) {
  const values = markerValues(body, key);
  return values.length === 1 ? values[0] : '';
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

function canonicalOwner(file) {
  if (/[*?]/.test(file)) return null;
  try {
    const output = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pri-fleet.mjs'), 'route', file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const route = JSON.parse(output);
    return route?.owned === true ? route.primary || null : null;
  } catch {
    return null;
  }
}

function hasCanonicalPrimaryPath(agent, paths) {
  return paths.some(file => canonicalOwner(file) === agent);
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
    if (!hasCanonicalPrimaryPath(agent, paths)) return { ok: false, reason: 'NO_CANONICAL_PRIMARY_PATH' };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'OWNERSHIP_DENY', detail: String(error.stderr || error.message).trim() };
  }
}

function normalizeMission(input) {
  return {
    id: String(input.id || ''), agent: String(input.agent || ''), branch: String(input.branch || ''), risk: String(input.risk || ''),
    status: String(input.status || ''), updated_at: String(input.updated_at || ''), base_sha: String(input.base_sha || ''),
    issue_state: String(input.issue_state || ''), review_head: String(input.review_head || ''), lease_heartbeat_at: String(input.lease_heartbeat_at || ''),
    lease_heartbeat_ref: String(input.lease_heartbeat_ref || ''), lease_heartbeat_by: String(input.lease_heartbeat_by || ''),
    paths: Array.isArray(input.paths) ? input.paths.map(String) : [], dependencies: Array.isArray(input.dependencies) ? input.dependencies.map(String) : []
  };
}

function canRunConcurrently(leftInput, rightInput) {
  const a = normalizeMission(leftInput), b = normalizeMission(rightInput);
  const deny = (reason, detail = null) => ({ decision: 'DENY', reason, detail, left: a.id, right: b.id });
  if (!a.id || !b.id || a.id === b.id) return deny('MISSION_ID_CONFLICT');
  if (!agents.has(a.agent) || !agents.has(b.agent) || a.agent === 'director' || b.agent === 'director') return deny('INVALID_AGENT');
  if (a.agent === b.agent) return deny('OWNER_NOT_DISTINCT');
  if (!/^[0-9a-f]{7,40}$/i.test(a.base_sha) || !/^[0-9a-f]{7,40}$/i.test(b.base_sha)) return deny('INVALID_BASE_SHA');
  if (a.base_sha !== b.base_sha) return deny('BASE_SHA_MISMATCH');
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
  return { decision: 'ALLOW', reason: 'DISJOINT', left: a.id, right: b.id, evidence: { left_agent: a.agent, right_agent: b.agent, base_sha: a.base_sha, left_paths: a.paths, right_paths: b.paths, left_derived_roots: [...ar], right_derived_roots: [...br] } };
}

// One ledger interpretation is shared by CI validation and advisory admission.
// Closed historical issues are audited, never admitted. Open stale/unknown
// writer records cause a hard stop until the governor explicitly reconciles
// them. An issue comment's updated_at has NO lease-renewal authority.
function issueMission(issue) {
  return normalizeMission({
    id: marker(issue.body, 'Pri-Mission-ID'), status: marker(issue.body, 'Pri-Mission-Status'),
    agent: marker(issue.body, 'Pri-Agent'), branch: marker(issue.body, 'Pri-Branch'),
    risk: marker(issue.body, 'Pri-Risk'), base_sha: marker(issue.body, 'Pri-Base-SHA'),
    updated_at: issue.updated_at, issue_state: issue.state,
    review_head: marker(issue.body, control.ledger.record_markers.review_head),
    lease_heartbeat_at: marker(issue.body, control.lease.heartbeat_field),
    lease_heartbeat_ref: marker(issue.body, control.lease.progress_ref_field),
    lease_heartbeat_by: marker(issue.body, control.lease.heartbeat_agent_field),
    paths: listMarker(marker(issue.body, 'Pri-Paths')), dependencies: listMarker(marker(issue.body, 'Pri-Dependencies'))
  });
}

function inspectLedger(issues, now = Date.now()) {
  const errors = [], warnings = [];
  if (!Array.isArray(issues)) return { errors:['ledger snapshot must be an array'], warnings, managed:[], open:[], active:[] };
  // Inventory membership is determined by title; deleting the ID cannot
  // make an open writer disappear from admission or validation.
  const managed = issues.filter(issue => !issue.pull_request && String(issue.title || '').startsWith(control.ledger.title_prefix));
  const open = [];
  const requiredMarkers = ['Pri-Mission-ID','Pri-Mission-Status','Pri-Agent','Pri-Branch','Pri-Risk','Pri-Base-SHA','Pri-Attempt','Pri-Failure-Fingerprint'];
  const optionalMarkers = ['Pri-Paths','Pri-Dependencies',control.ledger.record_markers.review_head,
    control.lease.heartbeat_field,control.lease.progress_ref_field,control.lease.heartbeat_agent_field];
  for (const issue of managed) {
    const mission = issueMission(issue);
    if (String(issue.state || '').toLowerCase() === 'closed') {
      if (WRITER_STATES.has(mission.status)) warnings.push(`closed issue #${issue.number ?? '?'} retains historical writer status ${mission.status}`);
      continue;
    }
    if (String(issue.state || '').toLowerCase() !== 'open') { errors.push(`untrusted issue state for #${issue.number ?? '?'}`); continue; }
    for (const key of requiredMarkers) {
      const values = markerValues(issue.body, key);
      if (values.length !== 1 || !values[0])
        errors.push('malformed required marker ' + key + ' in open issue #' + (issue.number ?? '?') + ' (count ' + values.length + ')');
    }
    for (const key of optionalMarkers) {
      const values = markerValues(issue.body, key);
      if (values.length > 1 || (values.length === 1 && !values[0]))
        errors.push('malformed optional marker ' + key + ' in open issue #' + (issue.number ?? '?') + ' (count ' + values.length + ')');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mission.id))
      errors.push('malformed mission ID syntax in open issue #' + (issue.number ?? '?'));
    open.push({issue, mission});
  }
  // Unknown managed states and duplicate mission identities must never
  // disappear from the live writer ledger through permissive filtering.
  const seenAllIds = new Set(), seenAllBranches = new Set();
  for (const {issue, mission} of open) {
    if (!control.states.includes(mission.status))
      errors.push(`unknown status for managed issue #${issue.number ?? '?'}`);
    if (!mission.id || seenAllIds.has(mission.id))
      errors.push(`duplicate or missing managed mission ID in open issue #${issue.number ?? '?'}`);
    seenAllIds.add(mission.id);
    if (!mission.branch || seenAllBranches.has(mission.branch))
      errors.push(`duplicate or missing managed branch in open issue #${issue.number ?? '?'}`);
    seenAllBranches.add(mission.branch);
  }
  const active = open.filter(({mission}) => WRITER_STATES.has(mission.status));
  for (const {issue,mission} of open) if (REVIEW_STATES.has(mission.status) && !/^[0-9a-f]{40}$/i.test(mission.review_head))
    errors.push(`review or repair-waiting issue #${issue.number ?? '?'} needs a pinned Pri-Review-Head`);
  for (const {issue, mission} of active) {
    if (!mission.lease_heartbeat_at || !/^[0-9a-f]{40}$/i.test(mission.lease_heartbeat_ref) || mission.lease_heartbeat_by !== mission.agent) {
      errors.push(`writer lease #${issue.number ?? '?'} lacks a valid explicit progress heartbeat`);
    } else if (!freshness(mission.lease_heartbeat_at, now).valid) {
      errors.push(`writer lease #${issue.number ?? '?'} expired: reconcile before admitting another writer`);
    }
  }
  const cap = maxWriters();
  if (active.length > cap) errors.push(`expected 0..${cap} writer leases, found ${active.length}`);
  const seenIds = new Set(), seenBranches = new Set();
  for (const {issue, mission} of active) {
    if (!mission.id || seenIds.has(mission.id)) errors.push(`duplicate or missing mission id #${issue.number ?? '?'}`);
    seenIds.add(mission.id);
    if (!mission.branch || seenBranches.has(mission.branch)) errors.push(`duplicate or missing mission branch #${issue.number ?? '?'}`);
    seenBranches.add(mission.branch);
    if (!agents.has(mission.agent) || mission.agent === 'director') errors.push(`invalid owner #${issue.number ?? '?'}`);
    const guard = fleetGuard(mission.agent, mission.paths);
    if (!guard.ok) errors.push(`invalid canonical ownership #${issue.number ?? '?'}: ${guard.reason}`);
    if (!risks.has(mission.risk)) errors.push(`invalid risk #${issue.number ?? '?'}`);
    if (!/^[0-9a-f]{7,40}$/i.test(mission.base_sha)) errors.push(`invalid base #${issue.number ?? '?'}`);
    const attempt=marker(issue.body,'Pri-Attempt'), failure=marker(issue.body,'Pri-Failure-Fingerprint');
    if (!/^\d+$/.test(attempt)) errors.push(`invalid attempt #${issue.number ?? '?'}`);
    if (failure && failure !== 'none' && !/^[0-9a-f]{64}$/i.test(failure)) errors.push(`invalid failure fingerprint #${issue.number ?? '?'}`);
  }
  if (active.length > 1) for (let i=0;i<active.length;i++) for (let j=i+1;j<active.length;j++) {
    const result=canRunConcurrently(active[i].mission,active[j].mission);
    if (result.decision !== 'ALLOW') errors.push(`concurrency denied #${active[i].issue.number}/#${active[j].issue.number}: ${result.reason}`);
  }
  return { errors, warnings, managed, open, active };
}

function validateLedger(issues, expected, now = Date.now()) {
  const snapshot = inspectLedger(issues, now);
  const errors = [...snapshot.errors];
  if (!/^[0-9a-f]{40}$/i.test(String(expected.head_sha || '')))
    errors.push('missing or invalid exact 40-character PR head SHA');
  const target = snapshot.open.find(({mission}) => mission.id === expected.mission);
  if (!target) errors.push('mission marker does not match an open managed issue');
  else {
    const m = target.mission;
    if (!WRITER_STATES.has(m.status) && !REVIEW_STATES.has(m.status))
      errors.push('mission state is not eligible for PR validation');
    if (m.agent !== expected.agent) errors.push('agent marker does not match PR');
    if (m.branch !== expected.branch) errors.push('branch marker does not match PR');
    if (m.risk !== expected.risk) errors.push('risk marker does not match PR');
    if (WRITER_STATES.has(m.status) && m.lease_heartbeat_ref !== expected.head_sha) errors.push('active progress reference does not match exact PR head');
    if (REVIEW_STATES.has(m.status) && (!/^[0-9a-f]{40}$/i.test(String(expected.head_sha || '')) || m.review_head !== expected.head_sha))
      errors.push('review head does not match exact PR head');
  }
  return { valid: errors.length === 0, errors, warnings: snapshot.warnings,
    issue_number:target?.issue.number ?? null, managed_count:snapshot.managed.length,
    active_count:snapshot.active.length, max_writers:maxWriters() };
}

// Advisory only. Snapshot approval cannot be admission: two concurrent
// consumers may observe the same available slot. Until a serialized
// authoritative GitHub admission transaction exists, all candidate writes are
// denied even if a single snapshot appears eligible.
function admit(candidateInput, activeInputs, now = Date.now()) {
  const candidate=normalizeMission(candidateInput);
  const snap=inspectLedger(activeInputs,now);
  if (snap.errors.length) return {decision:'DENY',reason:'LEDGER_INVALID',errors:snap.errors,active_writers:snap.active.map(x=>x.mission.id)};
  const active=snap.active.map(x=>x.mission);
  if (active.some(x=>x.id===candidate.id)) return {decision:'DENY',reason:'MISSION_ALREADY_ACTIVE'};
  const gate=fleetGuard(candidate.agent,candidate.paths);
  if (!gate.ok) return {decision:'DENY',reason:gate.reason,detail:gate.detail||null};
  if (active.length>=maxWriters()) return {decision:'DENY',reason:'WRITER_CAP'};
  for (const x of active) {
    const result=canRunConcurrently(candidate,x);
    if (result.decision!=='ALLOW') return result;
  }
  return {decision:'DENY',reason:'SERIALIZED_ADMISSION_REQUIRED',
    eligible_on_snapshot:true,active_writers:active.map(x=>x.id)};
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
  if (!args[0] || !args[1] || !args[2] || !args[3] || !args[4] || !args[5]) throw new Error('validate-ledger requires issues.json agent mission branch risk head_sha');
  const result = validateLedger(readJson(path.resolve(args[0])), { agent: args[1], mission: args[2], branch: args[3], risk: args[4], head_sha: args[5] });
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
