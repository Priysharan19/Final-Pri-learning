#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_FILE = path.join(ROOT, '.pri-os', 'fleet.json');
const DERIVED_ARTIFACT_FILE = path.join(ROOT, '.pri-os', 'derived-artifacts.json');
const MISSION_CONTROL_FILE = path.join(ROOT, '.pri-os', 'mission-control.json');
const PACKAGE_FILE = path.join(ROOT, 'package.json');
const RISK_ORDER = ['R1', 'R2', 'R3', 'R4'];

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function loadFleet() {
  return readJson(FLEET_FILE);
}

function loadDerivedArtifacts() {
  return readJson(DERIVED_ARTIFACT_FILE);
}

function globRegex(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if ('\\.^$+?()[]{}|'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`${out}$`);
}

function matches(file, pattern) {
  return globRegex(pattern).test(file);
}

function getAgent(fleet, id) {
  const agent = fleet.agents.find(item => item.id === id);
  if (!agent) throw new Error(`unknown agent '${id}'`);
  return agent;
}

function ruleSpecificity(rule) {
  return rule.pattern.replace(/\*/g, '').length;
}

function ownerFor(fleet, file) {
  const matched = fleet.ownership_rules.filter(item => matches(file, item.pattern));
  if (!matched.length) return null;
  matched.sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a) || b.pattern.length - a.pattern.length);
  const best = matched[0];
  const bestSpecificity = ruleSpecificity(best);
  const tied = matched.filter(rule => ruleSpecificity(rule) === bestSpecificity && rule.pattern.length === best.pattern.length);
  const primaries = new Set(tied.map(rule => rule.primary));
  if (primaries.size > 1) {
    throw new Error(`ambiguous primary ownership for ${file}: ${tied.map(rule => `${rule.pattern}=>${rule.primary}`).join(', ')}`);
  }
  return { ...best, specificity: bestSpecificity };
}

function derivedRuleFor(policy, file) {
  const found = (policy.artifacts || []).filter(rule => (rule.patterns || []).some(pattern => matches(file, pattern)));
  if (found.length > 1) {
    throw new Error(`ambiguous derived artifact policy for ${file}: ${found.map(rule => rule.id).join(', ')}`);
  }
  return found[0] || null;
}

function changedFiles(base = 'origin/main') {
  const text = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
  return text ? text.split('\n').filter(Boolean) : [];
}

function isCollaborativeTest(file, owner, agentId) {
  if (!owner || owner.primary !== 'qa-release' || agentId === 'director') return false;
  return file.startsWith('client/test/') || file.startsWith('server/test/');
}

function hasPrimaryOwnedDerivedSource(fleet, policy, rule, agentId, files) {
  return files.some(file => {
    if (derivedRuleFor(policy, file)) return false;
    if (!(rule.source_patterns || []).some(pattern => matches(file, pattern))) return false;
    return ownerFor(fleet, file)?.primary === agentId;
  });
}

function isCollaborativeDerivedArtifact(file, owner, agentId, files, fleet, policy) {
  if (!owner || agentId === 'director') return false;
  const rule = derivedRuleFor(policy, file);
  if (!rule) return false;
  if (owner.primary !== rule.canonical_owner) return false;
  if (rule.requires_primary_owned_source !== true) return false;
  return hasPrimaryOwnedDerivedSource(fleet, policy, rule, agentId, files);
}

function guardViolations(fleet, policy, agentId, files) {
  const violations = [];
  for (const file of files) {
    const owner = ownerFor(fleet, file);
    if (!owner) {
      violations.push(`${file}: unowned`);
      continue;
    }
    if (owner.primary === agentId) continue;
    if (isCollaborativeTest(file, owner, agentId)) continue;
    if (isCollaborativeDerivedArtifact(file, owner, agentId, files, fleet, policy)) continue;
    violations.push(`${file}: primary=${owner.primary}, selected=${agentId}`);
  }
  return violations;
}

function maxRisk(fleet, files) {
  let result = 'R1';
  const details = [];
  for (const file of files) {
    const owner = ownerFor(fleet, file);
    const risk = owner?.risk || 'R4';
    details.push({ file, risk, primary: owner?.primary || null });
    if (RISK_ORDER.indexOf(risk) > RISK_ORDER.indexOf(result)) result = risk;
  }
  return { risk: result, details };
}

function validateDerivedPolicy(fleet, policy, ids) {
  const errors = [];
  if (policy.version !== 1) errors.push('derived-artifacts.version must be 1');
  if (!Array.isArray(policy.artifacts) || policy.artifacts.length === 0) {
    errors.push('derived-artifacts must define at least one artifact');
    return errors;
  }

  const artifactIds = new Set();
  const patterns = new Set();
  for (const rule of policy.artifacts) {
    if (!rule.id || !/^[a-z0-9-]+$/.test(rule.id)) errors.push(`invalid derived artifact id: ${rule.id}`);
    if (artifactIds.has(rule.id)) errors.push(`duplicate derived artifact id: ${rule.id}`);
    artifactIds.add(rule.id);

    if (!ids.has(rule.canonical_owner)) errors.push(`${rule.id}: unknown canonical owner '${rule.canonical_owner}'`);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) errors.push(`${rule.id}: patterns are required`);
    if (!Array.isArray(rule.source_patterns) || rule.source_patterns.length === 0) errors.push(`${rule.id}: source_patterns are required`);
    if (!rule.producer) errors.push(`${rule.id}: producer is required`);
    if (!rule.required_gate_id || !fleet.gates?.[rule.required_gate_id]) {
      errors.push(`${rule.id}: required_gate_id must reference a typed fleet gate`);
    }
    if (rule.requires_primary_owned_source !== true) {
      errors.push(`${rule.id}: requires_primary_owned_source must remain true`);
    }

    for (const pattern of rule.patterns || []) {
      if (patterns.has(pattern)) errors.push(`duplicate derived artifact pattern: ${pattern}`);
      patterns.add(pattern);
      const sample = pattern.replace(/\*\*/g, '__sample__').replace(/\*/g, 'x');
      const owner = ownerFor(fleet, sample);
      if (!owner) errors.push(`${rule.id}: derived pattern is not canonically owned: ${pattern}`);
      else if (owner.primary !== rule.canonical_owner) {
        errors.push(`${rule.id}: ${pattern} canonical owner is ${owner.primary}, expected ${rule.canonical_owner}`);
      }
    }
  }
  return errors;
}

function validate(fleet, policy) {
  const errors = [];
  if (fleet.version !== 2) errors.push('fleet.version must be 2');
  if (!Array.isArray(fleet.agents) || fleet.agents.length < 8) errors.push('fleet must define at least 8 agents');
  if (!fleet.gates || typeof fleet.gates !== 'object') errors.push('fleet.gates is required');
  if (!Array.isArray(fleet.ownership_rules) || fleet.ownership_rules.length === 0) errors.push('fleet.ownership_rules is required');

  const ids = new Set();
  for (const agent of fleet.agents || []) {
    if (!agent.id || !/^[a-z0-9-]+$/.test(agent.id)) errors.push(`invalid agent id: ${agent.id}`);
    if (ids.has(agent.id)) errors.push(`duplicate agent id: ${agent.id}`);
    ids.add(agent.id);
    if (!agent.role || !agent.mission) errors.push(`${agent.id}: role and mission are required`);
    if (!Array.isArray(agent.gate_ids) || agent.gate_ids.length === 0) errors.push(`${agent.id}: gate_ids are required`);
  }

  for (const required of ['director', 'handwriting', 'math-reasoning', 'platform', 'security', 'qa-release']) {
    if (!ids.has(required)) errors.push(`required agent missing: ${required}`);
  }

  let packageScripts = {};
  try {
    packageScripts = readJson(PACKAGE_FILE).scripts || {};
  } catch (error) {
    errors.push(`package.json invalid: ${error.message}`);
  }

  for (const [gateId, gate] of Object.entries(fleet.gates || {})) {
    if (!/^[a-z0-9-]+$/.test(gateId)) errors.push(`invalid gate id: ${gateId}`);
    if (!gate.command || !gate.platform || !gate.severity || !gate.evidence_class) errors.push(`${gateId}: incomplete typed gate`);
    if (!Number.isInteger(gate.timeout_minutes) || gate.timeout_minutes <= 0) errors.push(`${gateId}: timeout_minutes must be positive integer`);
    const npmRun = String(gate.command || '').match(/^npm run ([^\s]+)/);
    if (npmRun && !packageScripts[npmRun[1]]) errors.push(`${gateId}: npm script '${npmRun[1]}' does not exist in root package.json`);
    const nodeFile = String(gate.command || '').match(/^node ([^\s]+)/);
    if (nodeFile && !existsSync(path.join(ROOT, nodeFile[1]))) errors.push(`${gateId}: node target '${nodeFile[1]}' does not exist`);
  }

  for (const agent of fleet.agents || []) {
    for (const gateId of agent.gate_ids || []) {
      if (!fleet.gates?.[gateId]) errors.push(`${agent.id}: unknown gate '${gateId}'`);
    }
  }

  const patterns = new Set();
  for (const rule of fleet.ownership_rules || []) {
    if (!rule.pattern || !rule.primary || !rule.risk) errors.push('ownership rule requires pattern, primary and risk');
    if (patterns.has(rule.pattern)) errors.push(`duplicate ownership pattern: ${rule.pattern}`);
    patterns.add(rule.pattern);
    if (!ids.has(rule.primary)) errors.push(`${rule.pattern}: unknown primary owner '${rule.primary}'`);
    if (!RISK_ORDER.includes(rule.risk)) errors.push(`${rule.pattern}: invalid risk '${rule.risk}'`);
    for (const reviewer of rule.reviewers || []) {
      if (!ids.has(reviewer)) errors.push(`${rule.pattern}: unknown reviewer '${reviewer}'`);
      if (reviewer === rule.primary) errors.push(`${rule.pattern}: primary owner cannot review itself`);
    }
  }

  for (const key of [
    'single_writer',
    'evidence_before_claims',
    'no_threshold_weakening',
    'no_fabricated_human_or_hardware_evidence',
    'offline_first',
    'answer_blind_handwriting',
    'pr_before_main',
    'independent_review',
    'persistent_mission_ledger'
  ]) {
    if (fleet.principles?.[key] !== true) errors.push(`principle must remain true: ${key}`);
  }

  for (const risk of RISK_ORDER) {
    if (!fleet.risk_classes?.[risk]) errors.push(`missing risk class ${risk}`);
  }

  try {
    const mission = readJson(MISSION_CONTROL_FILE);
    if (mission.version !== 1) errors.push('mission-control.version must be 1');
    if (!mission.lease?.single_active_writer) errors.push('mission-control must enforce a single active writer');
  } catch (error) {
    errors.push(`mission-control config invalid: ${error.message}`);
  }

  errors.push(...validateDerivedPolicy(fleet, policy, ids));
  return errors;
}

function printAgentPrompt(fleet, id) {
  const agent = getAgent(fleet, id);
  const primaryPatterns = fleet.ownership_rules.filter(rule => rule.primary === id).map(rule => rule.pattern);
  const reviewPatterns = fleet.ownership_rules.filter(rule => (rule.reviewers || []).includes(id)).map(rule => rule.pattern);
  const gates = agent.gate_ids.map(gateId => ({ id: gateId, ...fleet.gates[gateId] }));
  console.log(`# ${agent.role}\n`);
  console.log(`Mission: ${agent.mission}\n`);
  console.log(`Primary ownership:\n${primaryPatterns.length ? primaryPatterns.map(p => `- ${p}`).join('\n') : '- none (review/read-only role)'}\n`);
  console.log(`Mandatory review surfaces:\n${reviewPatterns.length ? reviewPatterns.map(p => `- ${p}`).join('\n') : '- none'}\n`);
  console.log('Required gates:');
  for (const gate of gates) console.log(`- ${gate.id}: ${gate.command} [${gate.platform}, ${gate.severity}, ${gate.evidence_class}]`);
}

function printUsage() {
  console.log(`Pri Learning agent fleet V2\n\nCommands:\n  validate                         Validate fleet + mission-control + derived-artifact invariants\n  list                             List agents\n  route <repo-path>                Show canonical primary owner, reviewers and risk\n  prompt <agent-id>                Print specialist ownership/review/gates\n  guard <agent-id> [base]          Fail on unowned or cross-domain branch changes\n  simulate-guard <agent> <paths…>  Evaluate guard policy against explicit paths\n  risk [base]                      Compute maximum risk class for changed files\n  compare-risk <declared> [base]   Fail if declared PR risk understates diff risk\n  status                           Emit machine-readable fleet status`);
}

const fleet = loadFleet();
const derivedPolicy = loadDerivedArtifacts();
const [command = 'validate', ...args] = process.argv.slice(2);

if (command === 'validate') {
  const errors = validate(fleet, derivedPolicy);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(`PASS: ${fleet.agents.length} agents, ${Object.keys(fleet.gates).length} typed gates, ${fleet.ownership_rules.length} primary-ownership rules and ${derivedPolicy.artifacts.length} derived-artifact rule(s).`);
} else if (command === 'list') {
  for (const agent of fleet.agents) console.log(`${agent.id}\t${agent.role}`);
} else if (command === 'route') {
  const target = args[0];
  if (!target) throw new Error('route requires a repository path');
  const owner = ownerFor(fleet, target);
  const derived = derivedRuleFor(derivedPolicy, target);
  if (!owner) {
    console.log(JSON.stringify({ path: target, owned: false, risk: 'R4', derived: derived?.id || null }));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({
      path: target,
      owned: true,
      primary: owner.primary,
      reviewers: owner.reviewers || [],
      risk: owner.risk,
      rule: owner.pattern,
      specificity: owner.specificity,
      derived: derived?.id || null,
      derived_gate: derived?.required_gate_id || null
    }));
  }
} else if (command === 'prompt') {
  printAgentPrompt(fleet, args[0]);
} else if (command === 'guard') {
  const agent = getAgent(fleet, args[0]);
  if (agent.id === 'director') throw new Error('director is read-only and cannot own a code-changing branch');
  const base = args[1] || 'origin/main';
  const files = changedFiles(base);
  const violations = guardViolations(fleet, derivedPolicy, agent.id, files);
  if (violations.length) {
    console.error(`ERROR: ${agent.id} violates primary ownership:`);
    for (const item of violations) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log(`PASS: ${agent.id} owns/collaborates on all ${files.length} changed file(s).`);
} else if (command === 'simulate-guard') {
  const agent = getAgent(fleet, args[0]);
  if (agent.id === 'director') throw new Error('director is read-only and cannot own a code-changing branch');
  const files = args.slice(1);
  if (!files.length) throw new Error('simulate-guard requires at least one repository path');
  const violations = guardViolations(fleet, derivedPolicy, agent.id, files);
  if (violations.length) {
    console.error(`ERROR: ${agent.id} violates primary ownership:`);
    for (const item of violations) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log(`PASS: ${agent.id} owns/collaborates on all ${files.length} simulated file(s).`);
} else if (command === 'risk') {
  const base = args[0] || 'origin/main';
  const files = changedFiles(base);
  console.log(JSON.stringify(maxRisk(fleet, files), null, 2));
} else if (command === 'compare-risk') {
  const declared = args[0];
  if (!RISK_ORDER.includes(declared)) throw new Error(`declared risk must be one of ${RISK_ORDER.join(', ')}`);
  const base = args[1] || 'origin/main';
  const actual = maxRisk(fleet, changedFiles(base)).risk;
  if (RISK_ORDER.indexOf(declared) < RISK_ORDER.indexOf(actual)) {
    console.error(`ERROR: declared ${declared} understates actual ${actual}`);
    process.exit(1);
  }
  console.log(`PASS: declared ${declared} covers actual ${actual}.`);
} else if (command === 'status') {
  const errors = validate(fleet, derivedPolicy);
  console.log(JSON.stringify({
    name: fleet.name,
    version: fleet.version,
    valid: errors.length === 0,
    errors,
    agentCount: fleet.agents.length,
    gateCount: Object.keys(fleet.gates || {}).length,
    ownershipRuleCount: fleet.ownership_rules?.length || 0,
    derivedArtifactRuleCount: derivedPolicy.artifacts?.length || 0,
    principles: fleet.principles,
    riskClasses: fleet.risk_classes
  }, null, 2));
  if (errors.length) process.exitCode = 1;
} else {
  printUsage();
  process.exitCode = 2;
}
