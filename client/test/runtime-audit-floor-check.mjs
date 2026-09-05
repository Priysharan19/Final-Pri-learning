// Deterministic contract for tools/runtime-audit-floor.mjs — no network.
import { classifyAudit } from '../../tools/runtime-audit-floor.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + label); } };

// 1. Registry outage JSON (what npm printed on 2026-09-04) is an outage, not a failure.
const outage = classifyAudit({ status: 1, stdout: JSON.stringify({ error: { code: 'E503', summary: 'audit endpoint returned an error', detail: '503 Service Unavailable' } }), stderr: '' });
ok(outage.kind === 'outage', 'E503 classified as outage');

// 2. Stderr-only outage (older npm) also counts.
const stderrOutage = classifyAudit({ status: 1, stdout: '', stderr: 'npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk\nnpm error audit endpoint returned an error' });
ok(stderrOutage.kind === 'outage', 'stderr 503 classified as outage');

// 3. Real advisories fail, and the names are listed.
const advisories = classifyAudit({ status: 1, stdout: JSON.stringify({ vulnerabilities: { qs: { severity: 'high', isDirect: false } }, metadata: { vulnerabilities: { low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } }), stderr: '' });
ok(advisories.kind === 'advisories' && advisories.total === 1 && advisories.names[0].startsWith('qs'), 'advisories are a hard failure with names');

// 4. Clean report passes.
const clean = classifyAudit({ status: 0, stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } }), stderr: '' });
ok(clean.kind === 'clean', 'zero vulnerabilities passes');

// 5. End-to-end exit codes through the CLI with a fake npm: outage → 2 after retries, advisories → 1, clean → 0.
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'runtime-audit-floor.mjs');
const run = cmd => spawnSync(process.execPath, [script, 'server', '--attempts', '2', '--base-delay-ms', '0'], { encoding: 'utf8', env: { ...process.env, PRI_AUDIT_COMMAND: cmd } });
const outageRun = run(`printf '%s' '{"error":{"code":"E503","summary":"audit endpoint returned an error"}}'; exit 1`);
ok(outageRun.status === 2 && /UNEVALUATED/.test(outageRun.stderr), 'CLI exits 2 (unevaluated) after retries on outage');
const advisoryRun = run(`printf '%s' '{"vulnerabilities":{"qs":{"severity":"high"}},"metadata":{"vulnerabilities":{"total":1}}}'; exit 1`);
ok(advisoryRun.status === 1 && /FAIL/.test(advisoryRun.stderr), 'CLI exits 1 on advisories');
const cleanRun = run(`printf '%s' '{"vulnerabilities":{},"metadata":{"vulnerabilities":{"total":0}}}'; exit 0`);
ok(cleanRun.status === 0 && /PASS/.test(cleanRun.stdout), 'CLI exits 0 on clean');

console.log(`RUNTIME AUDIT FLOOR CONTRACT: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
