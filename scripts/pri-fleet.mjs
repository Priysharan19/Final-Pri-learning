#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_FILE = path.join(ROOT, '.pri-os', 'fleet.json');
const SHARED_PATHS = [
  '.pri-os/**',
  'AGENTS.md',
  'docs/**',
  'package.json',
  '.github/workflows/pri-agent-governance.yml'
];

function loadFleet() {
  return JSON.parse(readFileSync(FLEET_FILE, 'utf8'));
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

function matchesAny(file, patterns) {
  return patterns.some(pattern => pattern === '*' || globRegex(pattern).test(file));
}

function validate(fleet) {
  const errors = [];
  if (fleet.version !== 1) errors.push('fleet.version must be 1');
  if (!Array.isArray(fleet.agents) || fleet.agents.length < 8) errors.push('fleet must define at least 8 agents');
  const ids = new Set();
  for (const agent of fleet.agents || []) {
    if (!agent.id || !/^[a-z0-9-]+$/.test(agent.id)) errors.push(`invalid agent id: ${agent.id}`);
    if (ids.has(agent.id)) errors.push(`duplicate agent id: ${agent.id}`);
    ids.add(agent.id);
    if (!agent.role || !agent.mission) errors.push(`${agent.id}: role and mission are required`);
    if (!Array.isArray(agent.paths) || agent.paths.length === 0) errors.push(`${agent.id}: paths are required`);
    if (!Array.isArray(agent.gates) || agent.gates.length === 0) errors.push(`${agent.id}: at least one gate is required`);
  }
  for (const required of ['director', 'handwriting', 'math-reasoning', 'platform', 'security', 'qa-release']) {
    if (!ids.has(required)) errors.push(`required agent missing: ${required}`);
  }
  for (const key of [
    'single_writer',
    'evidence_before_claims',
    'no_threshold_weakening',
    'no_fabricated_human_or_hardware_evidence',
    'offline_first',
    'answer_blind_handwriting',
    'pr_before_main'
  ]) {
    if (fleet.principles?.[key] !== true) errors.push(`principle must remain true: ${key}`);
  }
  return errors;
}

function getAgent(fleet, id) {
  const agent = fleet.agents.find(item => item.id === id);
  if (!agent) throw new Error(`unknown agent '${id}'`);
  return agent;
}

function changedFiles(base = 'origin/main') {
  const text = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
  return text ? text.split('\n').filter(Boolean) : [];
}

function printUsage() {
  console.log(`Pri Learning agent fleet\n\nCommands:\n  validate                 Validate fleet invariants\n  list                     List specialist agents\n  route <repo-path>        Show agents that own a path\n  prompt <agent-id>        Print the agent's mission and release gates\n  guard <agent-id> [base]  Fail if this branch edits files outside the agent's ownership\n  status                   Emit a machine-readable fleet summary`);
}

const fleet = loadFleet();
const [command = 'validate', ...args] = process.argv.slice(2);

if (command === 'validate') {
  const errors = validate(fleet);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(`PASS: ${fleet.agents.length} agents; autonomy invariants intact.`);
} else if (command === 'list') {
  for (const agent of fleet.agents) console.log(`${agent.id}\t${agent.role}`);
} else if (command === 'route') {
  const target = args[0];
  if (!target) throw new Error('route requires a repository path');
  const owners = fleet.agents.filter(agent => agent.id !== 'director' && matchesAny(target, agent.paths));
  if (!owners.length) {
    console.log('unowned');
    process.exitCode = 2;
  } else {
    for (const owner of owners) console.log(`${owner.id}\t${owner.role}`);
  }
} else if (command === 'prompt') {
  const agent = getAgent(fleet, args[0]);
  console.log(`# ${agent.role}\n\nMission: ${agent.mission}\n\nOwned paths:\n${agent.paths.map(p => `- ${p}`).join('\n')}\n\nRequired gates:\n${agent.gates.map(g => `- ${g}`).join('\n')}`);
} else if (command === 'guard') {
  const agent = getAgent(fleet, args[0]);
  if (agent.id === 'director') throw new Error('director is read-only and cannot own a code-changing branch');
  const base = args[1] || 'origin/main';
  const files = changedFiles(base);
  const forbidden = files.filter(file => !matchesAny(file, [...agent.paths, ...SHARED_PATHS]));
  if (forbidden.length) {
    console.error(`ERROR: ${agent.id} changed files outside its ownership:`);
    for (const file of forbidden) console.error(`- ${file}`);
    process.exit(1);
  }
  console.log(`PASS: ${agent.id} owns all ${files.length} changed file(s).`);
} else if (command === 'status') {
  const errors = validate(fleet);
  console.log(JSON.stringify({
    name: fleet.name,
    version: fleet.version,
    agentCount: fleet.agents.length,
    valid: errors.length === 0,
    errors,
    principles: fleet.principles,
    agents: fleet.agents.map(({ id, role, paths, gates }) => ({ id, role, paths, gates }))
  }, null, 2));
  if (errors.length) process.exitCode = 1;
} else {
  printUsage();
  process.exitCode = 2;
}
