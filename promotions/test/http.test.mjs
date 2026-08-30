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

test('green tick requires follow, increments once, and same identity stays blocked after refollow', async (t) => {
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
  assert.match(landingHtml, /green tick requires/i);
  assert.match(landingHtml, /href="\/privacy"/);

  // First create a valid A2Z identity that is NOT following.
  const notFollowingResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: false }),
  });
  assert.equal(notFollowingResponse.status, 200);
  const notFollowingClaim = await notFollowingResponse.json();
  assert.equal(notFollowingClaim.status, 'issued');
  assert.match(notFollowingClaim.code, /^PRI-/);

  const claimPage = await fetch(`${baseUrl}/claim/${encodeURIComponent(notFollowingClaim.code)}`);
  assert.equal(claimPage.status, 200);
  const claimPageHtml = await claimPage.text();
  assert.match(claimPageHtml, /Verify follow & show green tick/);
  assert.match(claimPageHtml, /only if Instagram confirms/i);
  assert.match(claimPageHtml, /unfollowing and following again/i);

  const ready = await fetch(`${baseUrl}/api/customer/status?code=${encodeURIComponent(notFollowingClaim.code)}`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, 'ready');

  // No follow => no redemption, no counter increment, no green tick.
  const blocked = await fetch(`${baseUrl}/api/customer/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: notFollowingClaim.code }),
  });
  assert.equal(blocked.status, 403);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.status, 'follow_required');
  assert.equal(blockedBody.currentFollowState, false);
  assert.equal(blockedBody.redemptionCount, 0);

  const stillReady = await fetch(`${baseUrl}/api/customer/status?code=${encodeURIComponent(notFollowingClaim.code)}`);
  assert.equal((await stillReady.json()).status, 'ready');

  // Same Instagram identity follows. In dev simulation this rotates the
  // outstanding code but does not create a second claim.
  const followingResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: true }),
  });
  const followingClaim = await followingResponse.json();
  assert.equal(followingClaim.status, 'rotated');
  assert.match(followingClaim.code, /^PRI-/);

  const redeemed = await fetch(`${baseUrl}/api/customer/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: followingClaim.code }),
  });
  assert.equal(redeemed.status, 200);
  const redeemedBody = await redeemed.json();
  assert.equal(redeemedBody.status, 'redeemed');
  assert.equal(redeemedBody.currentFollowState, true);
  assert.equal(redeemedBody.redemptionCount, 1);
  assert.match(redeemedBody.redeemedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(redeemedBody.serverTime, /^\d{4}-\d{2}-\d{2}T/);

  const after = await fetch(`${baseUrl}/api/customer/status?code=${encodeURIComponent(followingClaim.code)}`);
  const afterBody = await after.json();
  assert.equal(afterBody.status, 'already_redeemed');
  assert.equal(afterBody.redemptionCount, 1);

  const repeat = await fetch(`${baseUrl}/api/customer/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: followingClaim.code }),
  });
  assert.equal(repeat.status, 409);
  const repeatBody = await repeat.json();
  assert.equal(repeatBody.status, 'already_redeemed');
  assert.equal(repeatBody.redemptionCount, 1);

  // Unfollow/refollow after redemption still cannot create another reward.
  const reclaimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-001', username: 'student', followsBusiness: true }),
  });
  const reclaim = await reclaimResponse.json();
  assert.equal(reclaim.status, 'already_redeemed');
  assert.equal('code' in reclaim, false);

  const secondClaimResponse = await fetch(`${baseUrl}/dev/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468', instagramScopedId: 'ig-http-002', username: 'student2', followsBusiness: true }),
  });
  const secondClaim = await secondClaimResponse.json();
  const secondRedeem = await fetch(`${baseUrl}/api/customer/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: secondClaim.code }),
  });
  const secondRedeemBody = await secondRedeem.json();
  assert.equal(secondRedeemBody.status, 'redeemed');
  assert.equal(secondRedeemBody.currentFollowState, true);
  assert.equal(secondRedeemBody.redemptionCount, 2);

  const privacy = await fetch(`${baseUrl}/privacy`);
  assert.equal(privacy.status, 200);
  assert.match(await privacy.text(), /live green tick is issued only when the follow relationship is positively confirmed/i);
  const deletion = await fetch(`${baseUrl}/data-deletion`);
  assert.equal(deletion.status, 200);
  const terms = await fetch(`${baseUrl}/terms`);
  assert.equal(terms.status, 200);
  assert.match(await terms.text(), /currently following @pri\.learning/i);
  assert.equal(stderr.includes('internal_error'), false);
});
