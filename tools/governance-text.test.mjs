#!/usr/bin/env node
// Governance text, one source of truth. AGENTS.md describes the writer pool and
// the mission state sets; .pri-os/mission-control.json declares them; the
// mission-control script reads them; the governance workflows call the
// validator with the exact head SHA; the fleet gives every V1 interface path an
// owner. This test fails when any two of those drift (release audit item 12,
// 1 November 2026: "AGENTS.md, mission-control.json and WRITER_STATES disagree").
// Hermetic: reads files and runs the repository's own scripts; no network.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');
let count = 0;
const ok = (value, message) => { assert.ok(value, message); count += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); count += 1; };

const agents = read('AGENTS.md');
const control = JSON.parse(read('.pri-os/mission-control.json'));
const script = read('scripts/pri-mission-control.mjs');

// ── the state sets: control file ⇄ script ⇄ AGENTS.md ─────────────────────────
const writer = control.lease.writer_holding_states;
const review = control.lease.review_states;
ok(Array.isArray(writer) && writer.length > 0 && Array.isArray(review) && review.length > 0, 'mission-control.json declares lease.writer_holding_states and lease.review_states');
ok(writer.every(s => control.states.includes(s)) && review.every(s => control.states.includes(s)), 'every declared state is a mission state');
ok(writer.every(s => !review.includes(s)), 'no state both holds a writer and is a review state');
const literal = name => { const m = script.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`)); return m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : null; };
eq(literal('DEFAULT_WRITER_STATES'), writer, 'the script\'s fallback writer states equal the control file');
eq(literal('DEFAULT_REVIEW_STATES'), review, 'the script\'s fallback review states equal the control file');
ok(/declaredStates\('writer_holding_states'/.test(script) && /declaredStates\('review_states'/.test(script), 'the script reads both sets from the control file');
ok(/version 2 requires lease\.\$\{key\}/.test(script), 'validate requires version 2 control files to declare both sets');
const backticked = list => list.map(s => `\`${s}\``).join(', ');
ok(agents.includes(`**Writer-holding states** (\`lease.writer_holding_states\`): ${backticked(writer)}.`), `AGENTS.md lists exactly the writer-holding states: ${writer.join(', ')}`);
ok(agents.includes(`**Review states** (\`lease.review_states\`): ${backticked(review)}.`), `AGENTS.md lists exactly the review states: ${review.join(', ')}`);
ok(!/Exactly one specialist holds the writer lease/.test(agents) && !/Only one mission may be in a writer-holding state/.test(agents), 'AGENTS.md no longer claims a single writer');
ok(agents.includes(`at most \`lease.max_writers\` (${control.lease.max_writers})`), `AGENTS.md quotes max_writers = ${control.lease.max_writers}`);
ok(agents.includes(`\`fallback_max_writers\` is ${control.lease.fallback_max_writers}`), 'AGENTS.md quotes fallback_max_writers');
ok(agents.includes(`\`lease.ttl_hours\` (${control.lease.ttl_hours})`), `AGENTS.md quotes the lease TTL of ${control.lease.ttl_hours} h`);
ok(/single_active_writer": false/.test(read('.pri-os/mission-control.json')) && control.lease.max_writers >= 1 && control.lease.max_writers <= 2, 'the control file is the bounded-pool policy the script enforces');
ok(/stays dormant \(owner default D26/.test(agents) && /\(#626, #647, #681\) do not merge/.test(agents), 'AGENTS.md records the dormant signed-admission programme (D26) instead of describing it as live');
ok(/admit denies every candidate by design|`admit` denies every candidate by design/.test(agents) && /SERIALIZED_ADMISSION_REQUIRED/.test(script), 'AGENTS.md says what the script does: admit always denies');

// The script's own validation still passes on the committed control file.
const validate = execFileSync(process.execPath, [join(ROOT, 'scripts/pri-mission-control.mjs'), 'validate'], { encoding: 'utf8' });
ok(/^PASS: mission control has/.test(validate) && validate.includes(`writer cap ${control.lease.max_writers}`), 'node scripts/pri-mission-control.mjs validate passes with the declared sets');

// ── validate-ledger is called with the exact head SHA everywhere ───────────────
// The callers are discovered, not listed: #697 retires the derived-mirror pair
// (generated bundles are no longer tracked), and a listed file that no longer
// exists would crash this suite instead of checking anything. Any new caller is
// held to the same contract; the governance workflow must remain one.
const ledgerCallers = readdirSync(join(ROOT, '.github/workflows')).filter(name => /\.ya?ml$/.test(name)).sort()
  .map(name => `.github/workflows/${name}`).filter(file => /validate-ledger/.test(read(file)));
ok(ledgerCallers.includes('.github/workflows/pri-agent-governance.yml'), 'pri-agent-governance.yml still calls validate-ledger');
for (const file of ledgerCallers) {
  const source = read(file);
  const calls = [...source.matchAll(/validate-ledger\s*(?:\\\n\s*)?([^\n]+)/g)].map(m => m[1].trim());
  ok(calls.length > 0, `${file} calls validate-ledger`);
  for (const call of calls) {
    const args = call.match(/"\$[A-Za-z_]+"|\$[A-Za-z_]+|\/tmp\/\S+|[a-z0-9-]+\/[a-z0-9\/-]+|\b[0-9a-f]{40}\b|\bR[1-4]\b|[a-z][a-z0-9-]*/g) || [];
    ok(args.length >= 6, `${file}: validate-ledger passes six arguments (issues agent mission branch risk head_sha), got ${args.length}: ${call}`);
  }
}
ok(/validate-ledger requires issues\.json agent mission branch risk head_sha/.test(script), 'the script states the six-argument contract');

// ── every V1 interface path has a fleet owner ─────────────────────────────────
const route = path => JSON.parse(execFileSync(process.execPath, [join(ROOT, 'scripts/pri-fleet.mjs'), 'route', path], { encoding: 'utf8' }));
for (const [path, primary] of [
  ['client/src/instrument/InstrumentShell.jsx', 'student-experience'],
  ['client/src/instrument/MarkStrip.jsx', 'student-experience'],
  ['client/src/App.jsx', 'student-experience'],
  ['client/src/theme.css', 'student-experience'],
  ['client/vite.config.js', 'reliability']
]) {
  const r = route(path);
  ok(r.owned === true && r.primary === primary, `${path} is owned by ${primary} (got ${r.owned ? r.primary : 'unowned'})`);
}
const fleetValidate = execFileSync(process.execPath, [join(ROOT, 'scripts/pri-fleet.mjs'), 'validate'], { encoding: 'utf8' });
ok(/^PASS:/.test(fleetValidate), 'node scripts/pri-fleet.mjs validate passes');

// ── the repository has a security policy and Dependabot ignores post-launch majors ──
const security = read('SECURITY.md');
ok(/security\/advisories\/new/.test(security) && /docs\/legal\/privacy\.md/.test(security) && /Do not open a public issue/.test(security), 'SECURITY.md gives the private reporting routes');
ok(/children/.test(security) && /not be run/.test(security), 'SECURITY.md states the live-data and no-exploit rules');
ok(!/bounty|reward programme/i.test(security) || /No payment programme exists/.test(security), 'SECURITY.md promises no bounty that does not exist');
const dependabot = read('.github/dependabot.yml');
for (const name of ['react', 'react-dom', '@types/react', 'express']) {
  ok(new RegExp(`dependency-name: '?${name.replace('/', '\\/')}'?\\n\\s+update-types: \\['version-update:semver-major'\\]`).test(dependabot), `Dependabot ignores ${name} majors`);
}
ok(/directory: \/ad[\s\S]*?dependency-name: '\*'\n\s+update-types: \['version-update:semver-major'\]/.test(dependabot), 'Dependabot ignores every major in the unshipped /ad folder');
ok(!/dependency-name: '\*'\n\s+update-types: \['version-update:semver-major'\][\s\S]*directory: \/(client|server)/.test(dependabot.split('directory: /ad')[0]), 'client and server still receive their non-React, non-Express majors');

// ── lane CI: AGENTS.md, the release policy and Main Integrity say the same thing ──
ok(agents.includes('the heavy workflows run on `task/train-*` pull requests, so `main` accepts only trains — `docs/release/ci-lanes.md`'), 'AGENTS.md states the lane split and the train-only merge rule');
ok(/so `main` accepts only trains \(`docs\/release\/ci-lanes\.md`\)/.test(read('docs/release/release-policy.md')), 'the release policy states the train-only merge rule');
ok(/if \[\[ "\$head_ref" != task\/train-\* \]\]/.test(read('.github/workflows/main-integrity.yml')), 'Main Integrity enforces the train-only merge rule AGENTS.md states');
ok(existsSync(join(ROOT, 'docs/release/ci-lanes.md')) && existsSync(join(ROOT, 'ci/check-counts.json')), 'the lane document and the check-count manifest exist');

// ── no workflow with write authority is bound to a branch that is not main ────
ok(!existsSync(join(ROOT, '.github/workflows/prepare-ios-sync.yml')), 'the one-shot prepare-ios-sync workflow (push to pri-local-ink-v2, contents: write) is gone');

console.log(`GOVERNANCE TEXT: PASS — ${count}/${count} checks`);
