import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function waitForHealth(baseUrl, child) {
  for (let i = 0; i < 50; i += 1) {
    if (child.exitCode != null) throw new Error(`server exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error('server did not become healthy');
}

test('HTTP flow exposes tracked A2Z DM, redeems once, and permanently blocks reclaim', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pri-promotions-'));
  const port = randomInt(18000, 28000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: here,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      PUBLIC_BASE_URL: baseUrl,
      PROMOTIONS_DB_PATH: join(dir, 'test.sqlite'),
      CLAIM_SECRET: 'test-claim-secret-which-is-long-enough-123456789',
      STAFF_PIN: '2468',
      CAMPAIGN_REF: 'pri-a2z-qr-2026',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(() => {
    if (child.exitCode == null) child.kill('SIGTERM');
    rmSync(dir, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl, child);

  const landing = await fetch(`${baseUrl}/c/a2z`);
  assert.equal(landing.status, 200);
  const landingHtml = await landing.text();
  assert.match(landingHtml, /https:\/\/ig\.me\/m\/pri\.learning\?ref=pri-a2z-qr-2026/);

  const claimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: true }),
  });
  assert.equal(claimResponse.status, 200);
  const claim = await claimResponse.json();
  assert.equal(claim.status, 'issued');
  assert.match(claim.code, /^PRI-/);

  const redeem = () => fetch(`${baseUrl}/api/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', code: claim.code }),
  });

  const first = await redeem();
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, 'redeemed');

  const second = await redeem();
  assert.equal(second.status, 409);
  assert.equal((await second.json()).status, 'already_redeemed');

  const reclaimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: false }),
  });
  const reclaim = await reclaimResponse.json();
  assert.equal(reclaim.status, 'already_redeemed');
  assert.equal('code' in reclaim, false);
  assert.equal(stderr.includes('internal_error'), false);
});
