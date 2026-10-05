// Self-test for tools/secret-scan.mjs: every pattern catches a planted value of
// its kind, near-misses and ordinary code do not trip it, an allowance is
// honoured and reported, a committed .env is caught by name, and findings never
// echo the secret itself. Planted values are assembled at runtime so this file
// does not trip the scan it tests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATTERNS, parseArgs, scanFiles, scanText } from './secret-scan.mjs';

const SCAN = join(dirname(fileURLToPath(import.meta.url)), 'secret-scan.mjs');

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

// The CLI against a planted BUILT BUNDLE (ledger 1.6): a fake client/dist whose
// hashed chunk embeds a provider key the way a leaked VITE_ variable would. The
// gate must exit 1, name the file and the pattern, and never print the key; the
// same tree without the plant must pass; and the CI flag must refuse to pass
// when there is no bundle to scan at all.
const built = mkdtempSync(join(tmpdir(), 'pri-secret-scan-dist-'));
try {
  mkdirSync(join(built, 'dist', 'assets'), { recursive: true });
  writeFileSync(join(built, 'dist', 'index.html'), '<!doctype html><script type="module" src="/assets/index-a1b2c3d4.js"></script>\n');
  writeFileSync(join(built, 'dist', 'assets', 'index-a1b2c3d4.js'), `const e="${planted['openai-api-key']}";fetch("https://api.openai.com/v1/responses",{headers:{authorization:"Bearer "+e}});\n`);
  writeFileSync(join(built, 'dist', 'assets', 'vendor-e5f6a7b8.js'), 'export const ok = 1;\n');
  const run = args => spawnSync(process.execPath, [SCAN, ...args], { encoding: 'utf8' });

  const leaked = run(['--dist-only', '--dist', join(built, 'dist')]);
  assert.equal(leaked.status, 1, 'a bundle with a planted provider key fails the gate (exit 1)');
  assert.match(leaked.stderr, /index-a1b2c3d4\.js:1\s+openai-api-key/, 'the finding names the bundled file and the pattern');
  assert.match(leaked.stderr, /SECRET SCAN: FAIL — 1 secret-shaped value/, 'and the summary counts it');
  assert.ok(!`${leaked.stdout}${leaked.stderr}`.includes(planted['openai-api-key'].slice(8)), 'the gate never prints the key it found');
  checks += 4;

  rmSync(join(built, 'dist', 'assets', 'index-a1b2c3d4.js'));
  writeFileSync(join(built, 'dist', 'assets', 'index-a1b2c3d4.js'), 'const e=import.meta.env.VITE_NOTHING;\n');
  const clean = run(['--dist-only', '--dist', join(built, 'dist')]);
  assert.equal(clean.status, 0, 'the same bundle without the plant passes');
  assert.match(clean.stdout, /SECRET SCAN: PASS — 3 files \(including the built client, 3 files\)/, 'and reports the bundle it read');
  checks += 2;

  const absent = run(['--require-dist', '--dist', join(built, 'no-such-dist')]);
  assert.equal(absent.status, 2, '--require-dist refuses to pass when the bundle is missing (exit 2)');
  assert.match(absent.stderr, /needs the built client/, 'and says what is missing');
  const defaults = parseArgs([]);
  assert.ok(defaults.dist.endsWith(join('client', 'dist')) && !defaults.requireDist && !defaults.distOnly, 'without flags the default bundle path is client/dist, optional');
  checks += 3;
} finally {
  rmSync(built, { recursive: true, force: true });
}

console.log(`SECRET SCAN SELF-TEST — PASS — ${checks}/${checks} checks`);
