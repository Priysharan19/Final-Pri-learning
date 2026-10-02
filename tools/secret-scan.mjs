#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · secret scan gate (V1 blocker #14)
//
//   node tools/secret-scan.mjs              tracked files + client/dist if built
//   node tools/secret-scan.mjs --dist-only  only the built client (CI build job)
//
// High-signal patterns only — provider key formats that are never legitimate in
// a repository: OpenAI keys, Razorpay live keys, Resend keys, PEM private keys,
// JWTs, AWS access keys and secrets, GitHub/Slack/Google tokens, Stripe live
// keys, and database URLs that embed a password. Every tracked file is read,
// including the iOS bundles (ios/*.swiftpm/Resources holds a copy of the web
// build) and, when present, client/dist — the bytes that actually ship.
//
// A tracked .env file is a failure by name, whatever it contains (only
// templates ending .example / .sample / .template may be committed).
//
// A genuine false positive is allowed on its own line with
//   pri-secret-scan: allow <reason>
// and every allowance is printed, so review sees it. Tests that need
// secret-shaped values build them at runtime instead of committing them.
//
// Findings print file:line and the pattern name with the match masked — this
// gate must never itself copy a secret into a CI log.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PATTERNS = Object.freeze([
  { name: 'openai-api-key', re: /(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g },
  { name: 'stripe-live-key', re: /(?<![A-Za-z0-9_])(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { name: 'razorpay-live-key', re: /(?<![A-Za-z0-9_])rzp_live_[A-Za-z0-9]{10,}/g },
  { name: 'resend-api-key', re: /(?<![A-Za-z0-9_])re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g },
  { name: 'pem-private-key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { name: 'jwt', re: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/g },
  { name: 'aws-access-key-id', re: /(?<![A-Z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])/g },
  { name: 'aws-secret-access-key', re: /aws_?secret_?access_?key["']?\s*[:=]\s*["']?[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/gi },
  { name: 'github-token', re: /(?<![A-Za-z0-9_])(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/g },
  { name: 'slack-token', re: /(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9-]{20,}/g },
  { name: 'google-api-key', re: /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g },
  { name: 'database-url-with-password', re: /\bpostgres(?:ql)?:\/\/[^:\s/@'"`]+:(?!\$\{|<|\*{3})[^@\s'"`]{6,}@[A-Za-z0-9.-]+/g }
]);

const ALLOW = /pri-secret-scan:\s*allow\s+\S/;
const ENV_FILE = /(?:^|\/)\.env(?:\.[^/]+)?$/;
const ENV_TEMPLATE = /\.(?:example|sample|template)$/;
const MAX_BYTES = 64 * 1024 * 1024;

function mask(value) {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}…(${value.length} chars)`;
}

/** Scan one file's text; returns { findings, allowed }. */
export function scanText(text, file) {
  const findings = [];
  const allowed = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      for (const match of line.matchAll(re)) {
        const entry = { file, line: index + 1, pattern: name, masked: mask(match[0]) };
        (ALLOW.test(line) ? allowed : findings).push(entry);
      }
    }
  }
  return { findings, allowed };
}

function binary(buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 8000)).includes(0);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

export function scanFiles(paths, root = ROOT) {
  const findings = [];
  const allowed = [];
  let scanned = 0;
  for (const absolute of paths) {
    const file = relative(root, absolute) || absolute;
    if (ENV_FILE.test(file) && !ENV_TEMPLATE.test(file)) findings.push({ file, line: 0, pattern: 'committed-env-file', masked: '(file)' });
    let stat;
    try { stat = statSync(absolute); } catch { continue; }
    if (!stat.isFile() || stat.size > MAX_BYTES) continue;
    const buffer = readFileSync(absolute);
    if (binary(buffer)) continue;
    scanned += 1;
    const result = scanText(buffer.toString('utf8'), file);
    findings.push(...result.findings);
    allowed.push(...result.allowed);
  }
  return { findings, allowed, scanned };
}

export function trackedFiles(root = ROOT) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean).map(path => join(root, path));
}

function main() {
  const distOnly = process.argv.includes('--dist-only');
  const dist = join(ROOT, 'client', 'dist');
  const paths = new Set(distOnly ? [] : trackedFiles());
  if (existsSync(dist)) for (const path of walk(dist)) paths.add(path);
  else if (distOnly) {
    console.error('secret-scan: --dist-only needs client/dist (run the build first).');
    process.exit(2);
  }
  const { findings, allowed, scanned } = scanFiles([...paths]);
  for (const entry of allowed) console.log(`  allowed  ${entry.file}:${entry.line}  ${entry.pattern}  ${entry.masked}`);
  if (findings.length) {
    for (const entry of findings) console.error(`  ✗ ${entry.file}:${entry.line}  ${entry.pattern}  ${entry.masked}`);
    console.error(`SECRET SCAN: FAIL — ${findings.length} secret-shaped value(s) in ${scanned} files. Remove and rotate them; never commit provider secrets.`);
    process.exit(1);
  }
  console.log(`SECRET SCAN: PASS — ${scanned} files${existsSync(dist) ? ' (including client/dist)' : ''}, ${PATTERNS.length} patterns, ${allowed.length} reviewed allowance(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
