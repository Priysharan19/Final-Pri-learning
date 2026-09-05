#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY = JSON.parse(readFileSync(path.join(ROOT, '.pri-os', 'derived-artifacts.json'), 'utf8'));
const IOS_RULE = (POLICY.artifacts || []).find(rule => rule.id === 'ios-web-mirrors');

if (!IOS_RULE) throw new Error('derived artifact rule ios-web-mirrors is missing');

const roots = (IOS_RULE.patterns || []).map(pattern => {
  if (!pattern.endsWith('/**')) throw new Error(`ios-web-mirrors pattern must end in /**: ${pattern}`);
  return pattern.slice(0, -2);
});

function safePath(file) {
  if (typeof file !== 'string' || !file) return false;
  if (file.includes('\0') || file.includes('\\')) return false;
  if (path.posix.isAbsolute(file)) return false;
  const normalized = path.posix.normalize(file);
  if (normalized !== file || normalized.startsWith('../') || normalized === '..') return false;
  return roots.some(root => file.startsWith(root) && file.length > root.length);
}

function validatePathList(parsed, allowEmpty = false) {
  if (!Array.isArray(parsed)) throw new Error('paths file must contain a JSON array');
  if (!allowEmpty && parsed.length === 0) throw new Error('derived artifact path list is empty');
  const seen = new Set();
  for (const item of parsed) {
    if (!safePath(item)) throw new Error(`unsafe derived artifact path: ${JSON.stringify(item)}`);
    if (seen.has(item)) throw new Error(`duplicate derived artifact path: ${item}`);
    seen.add(item);
  }
  return parsed;
}

function validatePaths(file, allowEmpty = false) {
  return validatePathList(JSON.parse(readFileSync(file, 'utf8')), allowEmpty);
}

function parseMissionBranch(branch) {
  const match = String(branch || '').match(/^agent\/mission\/([a-z0-9-]+)\/([a-z0-9][a-z0-9._-]*)$/);
  if (!match) throw new Error(`invalid autonomous mission branch: ${branch}`);
  return { agent: match[1], mission: match[2], branch };
}

function validateMetadata(file, expectedHead, expectedBase, expectedBranch) {
  const metadata = JSON.parse(readFileSync(file, 'utf8'));
  const expected = {
    head_sha: expectedHead,
    base_sha: expectedBase,
    head_ref: expectedBranch
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!value || metadata[key] !== value) {
      throw new Error(`derived artifact metadata mismatch for ${key}: got ${metadata[key]}, expected ${value}`);
    }
  }
  parseMissionBranch(metadata.head_ref);
  if (metadata.rule_id !== IOS_RULE.id) throw new Error(`unexpected derived rule: ${metadata.rule_id}`);
  if (metadata.required_gate_id !== IOS_RULE.required_gate_id) {
    throw new Error(`unexpected derived verifier: ${metadata.required_gate_id}`);
  }
  return metadata;
}

function gitNameOnly(repoDir, args) {
  const separator = args.indexOf('--');
  const commandArgs = separator === -1
    ? [...args, '-z']
    : [...args.slice(0, separator), '-z', ...args.slice(separator)];
  const raw = execFileSync('git', ['-C', repoDir, ...commandArgs], { encoding: 'buffer' });
  return raw.toString('utf8').split('\0').filter(Boolean);
}

function packageDerived(repoDir, outDir, headRef, headSha, baseSha) {
  if (!repoDir || !outDir || !headRef || !headSha || !baseSha) {
    throw new Error('package requires repo dir, output dir, head ref, head SHA and base SHA');
  }
  parseMissionBranch(headRef);

  const repo = path.resolve(repoDir);
  const out = path.resolve(outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // sync:ios can create a brand-new content-hashed asset. Plain `git diff`
  // ignores untracked files, so stage only the declared derived roots first.
  // This index is local to the read-only build workspace; no repository write
  // credential is available in that job.
  execFileSync('git', ['-C', repo, 'add', '-A', '--', ...roots], { stdio: 'pipe' });

  const allStaged = gitNameOnly(repo, ['diff', '--cached', '--name-only']);
  const unsafeStaged = allStaged.filter(file => !safePath(file));
  if (unsafeStaged.length) {
    throw new Error(`derived packaging staged path(s) outside policy: ${unsafeStaged.join(', ')}`);
  }

  const paths = gitNameOnly(repo, ['diff', '--cached', '--name-only', '--', ...roots]);
  validatePathList(paths, true);

  const patch = execFileSync(
    'git',
    ['-C', repo, 'diff', '--cached', '--binary', '--', ...roots],
    { encoding: 'buffer' }
  );

  writeFileSync(path.join(out, 'mirrors.patch'), patch);
  writeFileSync(path.join(out, 'paths.json'), JSON.stringify(paths, null, 2));
  writeFileSync(path.join(out, 'metadata.json'), JSON.stringify({
    rule_id: IOS_RULE.id,
    required_gate_id: IOS_RULE.required_gate_id,
    head_ref: headRef,
    head_sha: headSha,
    base_sha: baseSha
  }, null, 2));

  if (paths.length > 0 && patch.length === 0) {
    throw new Error('derived path list is non-empty but patch is empty');
  }
  if (paths.length === 0 && patch.length !== 0) {
    throw new Error('derived patch is non-empty but path list is empty');
  }

  return paths;
}

const [command, ...args] = process.argv.slice(2);

if (command === 'validate-paths') {
  const file = args[0];
  if (!file) throw new Error('validate-paths requires a JSON file');
  const paths = validatePaths(file, args.includes('--allow-empty'));
  console.log(`PASS: ${paths.length} derived artifact path(s) are inside the declared iPad web mirrors.`);
} else if (command === 'branch') {
  const parsed = parseMissionBranch(args[0]);
  console.log(JSON.stringify(parsed));
} else if (command === 'validate-metadata') {
  const [file, head, base, branch] = args;
  if (!file || !head || !base || !branch) throw new Error('validate-metadata requires file, head SHA, base SHA and branch');
  const metadata = validateMetadata(file, head, base, branch);
  console.log(`PASS: derived artifact metadata matches ${metadata.head_ref}@${metadata.head_sha}.`);
} else if (command === 'package') {
  const [repoDir, outDir, headRef, headSha, baseSha] = args;
  const paths = packageDerived(repoDir, outDir, headRef, headSha, baseSha);
  console.log(JSON.stringify({ packaged: paths.length, paths }));
} else {
  console.log('Usage:\n  node scripts/pri-derived-artifact-sync.mjs validate-paths <paths.json> [--allow-empty]\n  node scripts/pri-derived-artifact-sync.mjs branch <agent/mission/agent/mission-id>\n  node scripts/pri-derived-artifact-sync.mjs validate-metadata <metadata.json> <head-sha> <base-sha> <branch>\n  node scripts/pri-derived-artifact-sync.mjs package <repo-dir> <out-dir> <head-ref> <head-sha> <base-sha>');
  process.exitCode = 2;
}
