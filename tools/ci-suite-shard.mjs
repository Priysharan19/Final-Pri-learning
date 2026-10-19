#!/usr/bin/env node
// CI SUITE SHARDS — runs one shard of the root `npm test` chain so the
// "Suites, coverage and accuracy gates" check can fan out across runners
// without dropping or duplicating a suite.
//
// The root package.json `test` script stays the single source of truth: it
// must remain a plain `npm run <name> && npm run <name> …` chain, and this
// tool refuses to shard anything else. Every name is assigned to exactly one
// shard by a deterministic longest-first balance over measured CI seconds
// (unknown names weigh DEFAULT_WEIGHT, so a new suite is still run). Inside a
// shard the names keep their `npm test` order and stop at the first failure,
// exactly as the `&&` chain does.
//
//   node tools/ci-suite-shard.mjs --list --of=4
//   node tools/ci-suite-shard.mjs --shard=2 --of=4 --manifest=suite-shard-2.json
//   node tools/ci-suite-shard.mjs --verify --of=4 suite-shard-*.json
//
// --verify is the aggregate's proof: the manifests together name every suite
// of the CURRENT `test` script exactly once, each completed with exit 0.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Seconds per suite from CI run 39186561084 (2026-10-19, ubuntu-latest). Used
// only to balance shards; they never decide whether a suite runs.
const WEIGHTS = {
  'test:holdout3': 188, 'test:holdout2': 185, 'test:ink': 141, 'test:holdout': 115,
  'test:context': 87, 'test:hard': 80, 'test:india:difficulty': 73, 'test:india:exams': 72,
  'test:content:cert': 71, 'test:lines': 69, 'test:engine': 35, 'test:release:prep': 25,
  'test:backend': 17, 'test:engine:regex': 17, 'test:calculus': 15, 'test:jee': 14,
  'test:misconceptions': 13, 'test:india:adaptive': 11, 'test:exam:session': 10,
  'test:india:hardest': 9, 'test:marker:progress': 8
};
const DEFAULT_WEIGHT = 3;

export function suiteChain() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const script = String(pkg.scripts?.test || '');
  const parts = script.split('&&').map(s => s.trim());
  const names = parts.map(part => {
    const m = part.match(/^npm run ([A-Za-z0-9:_.-]+)$/);
    if (!m) throw new Error(`package.json "test" is no longer a plain "npm run <name>" chain (saw "${part}"); update tools/ci-suite-shard.mjs before sharding it`);
    return m[1];
  });
  if (!names.length) throw new Error('package.json "test" names no suite');
  if (new Set(names).size !== names.length) throw new Error('package.json "test" names a suite twice');
  return names;
}

export function plan(of) {
  const names = suiteChain();
  const load = Array.from({ length: of }, () => 0);
  const owner = new Map();
  const ordered = names.map((name, i) => ({ name, i, w: WEIGHTS[name] ?? DEFAULT_WEIGHT }))
    .sort((a, b) => b.w - a.w || a.i - b.i);
  for (const { name, w } of ordered) {
    let best = 0;
    for (let s = 1; s < of; s += 1) if (load[s] < load[best]) best = s;
    owner.set(name, best + 1);
    load[best] += w;
  }
  const shards = Array.from({ length: of }, (_, s) => ({
    shard: s + 1,
    seconds: load[s],
    names: names.filter(name => owner.get(name) === s + 1)
  }));
  return { names, shards };
}

function arg(name) {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const of = Number(arg('of'));
if (!Number.isInteger(of) || of < 1) {
  console.error('usage: --of=<shards> with --list | --shard=<n> [--manifest=file] | --verify <manifest…>');
  process.exit(2);
}

if (process.argv.includes('--list')) {
  for (const s of plan(of).shards) console.log(`shard ${s.shard}/${of} ~${s.seconds}s: ${s.names.join(' ')}`);
  process.exit(0);
}

if (process.argv.includes('--verify')) {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const { names } = plan(of);
  const seen = new Map();
  const problems = [];
  const shardsSeen = new Set();
  for (const file of files) {
    const m = JSON.parse(readFileSync(file, 'utf8'));
    if (m.of !== of) problems.push(`${file}: written for ${m.of} shards, expected ${of}`);
    if (shardsSeen.has(m.shard)) problems.push(`${file}: shard ${m.shard} reported twice`);
    shardsSeen.add(m.shard);
    if (m.status !== 0) problems.push(`${file}: shard ${m.shard} exited ${m.status}`);
    for (const done of m.completed || []) {
      seen.set(done, (seen.get(done) || 0) + 1);
    }
  }
  for (let s = 1; s <= of; s += 1) if (!shardsSeen.has(s)) problems.push(`shard ${s}/${of} left no manifest`);
  for (const name of names) {
    const n = seen.get(name) || 0;
    if (n !== 1) problems.push(`${name} completed ${n} times across the shards (must be exactly 1)`);
  }
  for (const name of seen.keys()) if (!names.includes(name)) problems.push(`${name} ran but is not in package.json "test"`);
  if (problems.length) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(`SUITE SHARDS: FAIL — ${problems.length} problem(s) across ${files.length} manifests`);
    process.exit(1);
  }
  console.log(`SUITE SHARDS: PASS — ${names.length}/${names.length} suites of npm test completed exactly once across ${of} shards`);
  process.exit(0);
}

const shard = Number(arg('shard'));
if (!Number.isInteger(shard) || shard < 1 || shard > of) {
  console.error(`--shard must be 1..${of}`);
  process.exit(2);
}
const mine = plan(of).shards[shard - 1].names;
const manifest = arg('manifest');
const completed = [];
let status = 0;
console.log(`SUITE SHARD ${shard}/${of}: ${mine.join(' ')}`);
for (const name of mine) {
  const run = spawnSync('npm', ['run', name], { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) {
    status = run.status ?? 1;
    console.error(`SUITE SHARD ${shard}/${of}: ${name} failed (exit ${status}); later suites in this shard did not run`);
    break;
  }
  completed.push(name);
}
if (manifest) writeFileSync(manifest, `${JSON.stringify({ shard, of, status, completed }, null, 2)}\n`);
process.exit(status);
