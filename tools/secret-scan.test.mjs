// Self-test for tools/secret-scan.mjs: every pattern catches a planted value of
// its kind, near-misses and ordinary code do not trip it, an allowance is
// honoured and reported, a committed .env is caught by name, and findings never
// echo the secret itself. Planted values are assembled at runtime so this file
// does not trip the scan it tests.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PATTERNS, scanFiles, scanText } from './secret-scan.mjs';

const j = (...parts) => parts.join('');
const alnum = n => 'aB3dE5gH7jK9mN1pQ2rS4tU6vW8xY0zC'.repeat(4).slice(0, n);
const UPPER = n => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.repeat(2).slice(0, n);
let checks = 0;

const planted = {
  'openai-api-key': j('sk-', 'proj-', alnum(48)),
  'stripe-live-key': j('sk', '_live_', alnum(24)),
  'razorpay-live-key': j('rzp', '_live_', alnum(14)),
  'resend-api-key': j('re', '_', alnum(9), '_', alnum(24)),
  'pem-private-key': j('-----BEGIN ', 'RSA PRIVATE KEY-----'),
  'jwt': j('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJ', 'zdWIiOiIxMjM0In0', '.', alnum(43)),
  'aws-access-key-id': j('AKIA', UPPER(16)),
  'aws-secret-access-key': j('aws_secret_access_key = ', alnum(32), 'aB3dE5gH'),
  'github-token': j('ghp', '_', alnum(36)),
  'slack-token': j('xox', 'b-', '1234567890-', alnum(24)),
  'google-api-key': j('AIza', alnum(35)),
  'database-url-with-password': j('postgres', '://svc_user:', 'S3cr3tPassw0rd', '@db.example.supabase.co:5432/postgres')
};
assert.deepEqual(Object.keys(planted).sort(), PATTERNS.map(p => p.name).sort(), 'every pattern has a planted sample');
checks++;

for (const [name, value] of Object.entries(planted)) {
  const { findings } = scanText(`const config = "${value}";\n`, 'planted.js');
  assert.ok(findings.some(f => f.pattern === name), `${name} is detected`);
  assert.ok(findings.every(f => !f.masked.includes(value.slice(6))), `${name} finding does not echo the secret`);
  checks += 2;
}

// Near-misses and ordinary code stay clean.
const clean = [
  'const task-runner = "sk-short";',
  'const mask = "sk-proj-"; // prefix only',
  'url: "postgres://postgres@localhost:5432/postgres"',
  'url: `postgres://${user}:${password}@${host}/db`',
  'PRI_DATABASE_URL=postgres://pri_server:<password>@db.example.supabase.co:5432/postgres',
  'const re_value = 1; const re_match_identifier_name = 2;',
  'rzp_test_ is the Razorpay test-mode prefix',
  'eyJ is how base64 JSON starts',
  'AKIA is the AWS access key prefix'
].join('\n');
assert.deepEqual(scanText(clean, 'clean.js').findings, [], 'ordinary code and placeholders are clean');
checks++;

// An allowance on the same line is reported, not failed.
const allowedLine = `const fixture = "${planted['jwt']}"; // pri-secret-scan: allow public test vector from RFC 7519`;
const allowed = scanText(allowedLine, 'fixture.js');
assert.equal(allowed.findings.length, 0, 'allowance suppresses the failure');
assert.equal(allowed.allowed.length, 1, 'and is listed for review');
assert.equal(scanText(`const x = "${planted['jwt']}"; // pri-secret-scan: allow`, 'bare.js').findings.length, 1, 'an allowance without a reason does not count');
checks += 3;

// File-level: a committed .env is caught by name; templates and binaries pass.
const dir = mkdtempSync(join(tmpdir(), 'pri-secret-scan-'));
try {
  mkdirSync(join(dir, 'server'));
  writeFileSync(join(dir, '.env'), 'NOTHING=here\n');
  writeFileSync(join(dir, 'server', '.env.production'), 'X=1\n');
  writeFileSync(join(dir, '.env.production.example'), 'PRI_RESEND_API_KEY=\n');
  writeFileSync(join(dir, 'bundle.js'), `!function(){var k="${planted['openai-api-key']}"}();`);
  writeFileSync(join(dir, 'image.png'), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]), Buffer.from(planted['openai-api-key'])]));
  const result = scanFiles(['.env', 'server/.env.production', '.env.production.example', 'bundle.js', 'image.png'].map(p => join(dir, p)), dir);
  const byFile = result.findings.map(f => `${f.file}:${f.pattern}`).sort();
  assert.deepEqual(byFile, ['.env:committed-env-file', 'bundle.js:openai-api-key', 'server/.env.production:committed-env-file'], 'env files by name, bundled keys by content; templates and binaries pass');
  checks++;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`SECRET SCAN SELF-TEST — PASS — ${checks}/${checks} checks`);
