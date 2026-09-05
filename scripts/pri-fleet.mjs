#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_FILE = path.join(ROOT, '.pri-os', 'fleet.json');
const MISSION_CONTROL_FILE = path.join(ROOT, '.pri-os', 'mission-control.json');
const RISK_ORDER = ['R1', 'R2', 'R3', 'R4'];

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function loadFleet() {
  return readJson(FLEET_FILE);
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

function ownerFor(fleet, file) {
  const rule = fleet.ownership_rules.find(item => matches(file, item.pattern));
  return rule ? { ...rule } : null;
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

function validate(fleet) {
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

  for (const [gateId, gate] of Object.entries(fleet.gates || {})) {
    if (!/^[a-z0-9-]+$/.test(gateId)) errors.push(`invalid gate id: ${gateId}`);
    if (!gate.command || !gate.platform || !gate.severity || !gate.evidence_class) errors.push(`${gateId}: incomplete typed gate`);
    if (!Number.isInteger(gate.timeout_minutes) || gate.timeout_minutes <= 0) errors.push(`${gateId}: timeout_minutes must be positive integer`);
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
  console.log(`Pri Learning agent fleet V2\n\nCommands:\n  validate                    Validate fleet + mission-control invariants\n  list                        List agents\n  route <repo-path>           Show canonical primary owner, reviewers and risk\n  prompt <agent-id>           Print specialist ownership/review/gates\n  guard <agent-id> [base]     Fail on unowned or cross-domain branch changes\n  risk [base]                 Compute maximum risk class for changed files\n  compare-risk <declared> [base]  Fail if declared PR risk understates diff risk\n  status                      Emit machine-readable fleet status`);
}

const fleet = loadFleet();
const [command = 'validate', ...args] = process.argv.slice(2);

if (command === 'validate') {
  const errors = validate(fleet);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(`PASS: ${fleet.agents.length} agents, ${Object.keys(fleet.gates).length} typed gates and ${fleet.ownership_rules.length} ordered ownership rules.`);
} else if (command === 'list') {
  for (const agent of fleet.agents) console.log(`${agent.id}\t${agent.role}`);
} else if (command === 'route') {
  const target = args[0];
  if (!target) throw new Error('route requires a repository path');
  const owner = ownerFor(fleet, target);
  if (!owner) {
    console.log(JSON.stringify({ path: target, owned: false, risk: 'R4' }));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({
      path: target,
      owned: true,
      primary: owner.primary,
      reviewers: owner.reviewers || [],
      risk: owner.risk,
      rule: owner.pattern
    }));
  }
} else if (command === 'prompt') {
  printAgentPrompt(fleet, args[0]);
} else if (command === 'guard') {
  const agent = getAgent(fleet, args[0]);
  if (agent.id === 'director') throw new Error('director is read-only and cannot own a code-changing branch');
  const base = args[1] || 'origin/main';
  const files = changedFiles(base);
  const violations = [];
  for (const file of files) {
    const owner = ownerFor(fleet, file);
    if (!owner) {
      violations.push(`${file}: unowned`);
      continue;
    }
    if (owner.primary !== agent.id && !isCollaborativeTest(file, owner, agent.id)) {
      violations.push(`${file}: primary=${owner.primary}, selected=${agent.id}`);
    }
  }
  if (violations.length) {
    console.error(`ERROR: ${agent.id} violates primary ownership:`);
    for (const item of violations) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log(`PASS: ${agent.id} owns/collaborates on all ${files.length} changed file(s).`);
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
  const errors = validate(fleet);
  console.log(JSON.stringify({
    name: fleet.name,
    version: fleet.version,
    valid: errors.length === 0,
    errors,
    agentCount: fleet.agents.length,
    gateCount: Object.keys(fleet.gates || {}).length,
    ownershipRuleCount: fleet.ownership_rules?.length || 0,
    principles: fleet.principles,
    riskClasses: fleet.risk_classes
  }, null, 2));
  if (errors.length) process.exitCode = 1;
} else {
  printUsage();
  process.exitCode = 2;
}
