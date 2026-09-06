#!/usr/bin/env node
// Pri Learning · runtime dependency security floor
//
// CI must fail on ANY advisory in runtime (non-dev) dependencies, but it must
// not fail because registry.npmjs.org had a bad five minutes. On 2026-09-04
// main went red solely because `npm audit` received HTTP 503 after `npm ci`
// had already reported 0 vulnerabilities. This wrapper separates the two
// outcomes: advisories are a hard failure with the list printed; a registry
// outage is retried with backoff and only after every attempt fails does it
// exit non-zero — with a message that names the outage, not a vulnerability.
//
// Usage: node tools/runtime-audit-floor.mjs <server|client|path> [--attempts N] [--base-delay-ms N]
// Test hook: PRI_AUDIT_COMMAND overrides the npm command (must print npm's --json audit output).

import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const prefix = args.find(a => !a.startsWith('--')) || 'server';
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const attempts = Math.max(1, flag('--attempts', 6));
const baseDelayMs = Math.max(0, flag('--base-delay-ms', 30_000));

const OUTAGE_CODES = new Set(['E503', 'E502', 'E504', 'E500', 'E429', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'ERR_SOCKET_TIMEOUT']);

function runAudit() {
  if (process.env.PRI_AUDIT_COMMAND) {
    const r = spawnSync('bash', ['-lc', process.env.PRI_AUDIT_COMMAND], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  }
  const r = spawnSync('npm', ['audit', '--prefix', prefix, '--omit=dev', '--audit-level=low', '--json'], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

export function classifyAudit({ status, stdout, stderr }) {
  let json = null;
  const text = String(stdout || '').trim();
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  if (json && json.error) {
    const code = String(json.error.code || '').toUpperCase();
    const summary = String(json.error.summary || json.error.detail || '');
    if (OUTAGE_CODES.has(code) || /audit endpoint returned an error|service unavailable|5\d\d/i.test(summary)) {
      return { kind: 'outage', detail: `${code || 'registry error'}: ${summary}`.trim() };
    }
    return { kind: 'error', detail: `${code}: ${summary}`.trim() };
  }
  if (json && json.metadata && json.metadata.vulnerabilities) {
    const v = json.metadata.vulnerabilities;
    const total = Number(v.total ?? Object.values(v).reduce((a, n) => a + Number(n || 0), 0));
    if (total > 0) {
      const names = Object.entries(json.vulnerabilities || {}).map(([name, info]) => `${name} (${info.severity}${info.isDirect ? ', direct' : ''})`);
      return { kind: 'advisories', total, names, detail: `${total} runtime advisories: ${names.join(', ') || 'see npm audit'}` };
    }
    return { kind: 'clean', total: 0, detail: 'found 0 runtime vulnerabilities' };
  }
  const err = String(stderr || '');
  if (/audit endpoint returned an error|503 Service Unavailable|E503|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(err)) {
    return { kind: 'outage', detail: err.split('\n').filter(Boolean).slice(-3).join(' | ') };
  }
  if (status === 0 && !text) return { kind: 'clean', total: 0, detail: 'npm audit exited 0 with no report' };
  return { kind: 'error', detail: (err || text || `exit ${status}`).split('\n').filter(Boolean).slice(-5).join(' | ') };
}

async function main() {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = classifyAudit(runAudit());
    last = result;
    if (result.kind === 'clean') {
      console.log(`RUNTIME AUDIT FLOOR (${prefix}): PASS — ${result.detail}`);
      return 0;
    }
    if (result.kind === 'advisories') {
      console.error(`RUNTIME AUDIT FLOOR (${prefix}): FAIL — ${result.detail}`);
      return 1;
    }
    if (result.kind === 'error') {
      console.error(`RUNTIME AUDIT FLOOR (${prefix}): FAIL — npm audit could not run: ${result.detail}`);
      return 1;
    }
    const delay = baseDelayMs * attempt;
    console.warn(`RUNTIME AUDIT FLOOR (${prefix}): registry outage on attempt ${attempt}/${attempts} — ${result.detail}${attempt < attempts ? `; retrying in ${Math.round(delay / 1000)}s` : ''}`);
    if (attempt < attempts) await sleep(delay);
  }
  console.error(`RUNTIME AUDIT FLOOR (${prefix}): UNEVALUATED — registry.npmjs.org unreachable after ${attempts} attempts (${last?.detail}). This is an infrastructure outage, not a vulnerability; re-run the job.`);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = await main();
}
