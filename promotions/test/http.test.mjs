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
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode != null) throw new Error(`server exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error('server did not become healthy');
}

test('HTTP flow includes customer QR, shift staff session, one-time redemption, and compliance pages', async (t) => {
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
  assert.match(landingHtml, /A2Z-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/);
  assert.match(landingHtml, /Following @pri\.learning is optional/);
  assert.match(landingHtml, /href="\/privacy"/);

  const privacy = await fetch(`${baseUrl}/privacy`);
  assert.equal(privacy.status, 200);
  assert.match(await privacy.text(), /Promotion privacy/);
  const deletion = await fetch(`${baseUrl}/data-deletion`);
  assert.equal(deletion.status, 200);
  assert.match(await deletion.text(), /A2Z data deletion request/);
  const terms = await fetch(`${baseUrl}/terms`);
  assert.equal(terms.status, 200);
  assert.match(await terms.text(), /Following @pri\.learning is optional/);
  const robots = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robots.status, 200);

  const claimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: false }),
  });
  assert.equal(claimResponse.status, 200);
  const claim = await claimResponse.json();
  assert.equal(claim.status, 'issued');
  assert.match(claim.code, /^PRI-/);

  const claimPage = await fetch(`${baseUrl}/claim/${encodeURIComponent(claim.code)}`);
  assert.equal(claimPage.status, 200);
  const claimPageHtml = await claimPage.text();
  assert.match(claimPageHtml, /Show this QR/);
  assert.match(claimPageHtml, /<svg/);
  assert.match(claimPageHtml, new RegExp(claim.code));

  const lockedStaff = await fetch(`${baseUrl}/staff`);
  assert.equal(lockedStaff.status, 200);
  assert.match(await lockedStaff.text(), /Unlock this phone/);

  const badSession = await fetch(`${baseUrl}/api/staff/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '0000' }),
  });
  assert.equal(badSession.status, 403);

  const session = await fetch(`${baseUrl}/api/staff/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468' }),
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie');
  assert.match(cookie, /pri_staff_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const unlockedStaff = await fetch(`${baseUrl}/staff`, { headers: { cookie } });
  assert.equal(unlockedStaff.status, 200);
  assert.match(await unlockedStaff.text(), /Staff device unlocked/);

  const scanPage = await fetch(`${baseUrl}/staff/scan?code=${encodeURIComponent(claim.code)}`, { headers: { cookie } });
  assert.equal(scanPage.status, 200);
  assert.match(await scanPage.text(), /Checking/);

  const redeemed = await fetch(`${baseUrl}/api/redeem-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ code: claim.code }),
  });
  assert.equal(redeemed.status, 200);
  assert.equal((await redeemed.json()).status, 'redeemed');

  const repeat = await fetch(`${baseUrl}/api/redeem-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ code: claim.code }),
  });
  assert.equal(repeat.status, 409);
  assert.equal((await repeat.json()).status, 'already_redeemed');

  const reclaimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: true }),
  });
  const reclaim = await reclaimResponse.json();
  assert.equal(reclaim.status, 'already_redeemed');
  assert.equal('code' in reclaim, false);
  assert.equal(stderr.includes('internal_error'), false);
});
