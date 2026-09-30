#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('.github/ci/deterministic-shards.json', root), 'utf8'));

function parseNpmTest() {
  const chain = String(pkg.scripts?.test || '').split(/\s*&&\s*/).filter(Boolean);
  assert.ok(chain.length, 'package.json scripts.test must not be empty');
  return chain.map((segment, index) => {
    const match = segment.match(/^npm run ([A-Za-z0-9:._-]+)$/);
    assert.ok(match, `npm test segment ${index + 1} is not a plain npm run command: ${segment}`);
    return match[1];
  });
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) seen.has(value) ? dupes.add(value) : seen.add(value);
  return [...dupes].sort();
}

function validate() {
  const npmTestScripts = parseNpmTest();
  assert.deepEqual(duplicates(npmTestScripts), [], 'npm test itself contains duplicate top-level scripts');
  const extras = manifest.requiredAdditionalScripts || [];
  assert.deepEqual(duplicates(extras), [], 'requiredAdditionalScripts contains duplicates');
  for (const script of extras) assert.ok(pkg.scripts?.[script], `required PRI-02 script is undefined: ${script}`);

  const expected = [...new Set([...npmTestScripts, ...extras])];
  const entries = Object.entries(manifest.shards || {});
  assert.ok(entries.length >= 3 && entries.length <= 5, 'deterministic CI must use 3-5 shards');
  const mapped = entries.flatMap(([shard, scripts]) => {
    assert.ok(Array.isArray(scripts) && scripts.length, `shard ${shard} must contain scripts`);
    return scripts.map(script => ({ script, shard }));
  });
  assert.deepEqual(duplicates(mapped.map(x => x.script)), [], 'a deterministic script is mapped more than once');

  const mappedSet = new Set(mapped.map(x => x.script));
  const expectedSet = new Set(expected);
  const missing = expected.filter(script => !mappedSet.has(script));
  const extra = mapped.map(x => x.script).filter(script => !expectedSet.has(script));
  assert.deepEqual(missing, [], `unmapped deterministic scripts: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `manifest contains scripts outside npm test/PRI-02 mandatory set: ${extra.join(', ')}`);

  return { npmTestScripts, extras, expected, entries, mapped };
}

function printTable(state) {
  const shardFor = new Map(state.mapped.map(x => [x.script, x.shard]));
  for (const script of state.expected) console.log(`${script}\t${shardFor.get(script)}`);
  console.log(`CI SHARD CONTRACT: PASS — ${state.npmTestScripts.length}/${state.npmTestScripts.length} npm test scripts + ${state.extras.length}/${state.extras.length} required PRI-02 regressions mapped exactly once across ${state.entries.length} shards.`);
}

function runShard(state, shard) {
  const scripts = manifest.shards[shard];
  assert.ok(scripts, `unknown deterministic shard: ${shard}`);
  console.log(`CI_SHARD_BEGIN ${shard} ${scripts.length}`);
  for (const script of scripts) {
    console.log(`CI_SCRIPT_BEGIN ${script}`);
    const result = spawnSync('npm', ['run', script], { cwd: new URL('.', root), stdio: 'inherit', env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`CI_SCRIPT_FAIL ${script} exit=${result.status}`);
      process.exit(result.status || 1);
    }
    console.log(`CI_SCRIPT_PASS ${script}`);
  }
  console.log(`CI_SHARD_PASS ${shard}`);
}

function verifyLog(state, path) {
  const log = readFileSync(path, 'utf8');
  for (const script of state.expected) {
    const token = `CI_SCRIPT_PASS ${script}`;
    const count = log.split(token).length - 1;
    assert.equal(count, 1, `expected exactly one successful log sentinel for ${script}, found ${count}`);
  }
  console.log(`CI SHARD LOG CONTRACT: PASS — ${state.expected.length}/${state.expected.length} expected script pass sentinels present exactly once.`);
}

const state = validate();
const [mode = '--check', value] = process.argv.slice(2);
if (mode === '--check') printTable(state);
else if (mode === '--run') runShard(state, value);
else if (mode === '--verify-log') verifyLog(state, value);
else throw new Error(`unknown mode: ${mode}`);
