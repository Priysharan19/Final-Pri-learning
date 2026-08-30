import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PromotionsStore } from '../src/store.mjs';
import {
  createCampaignPassCode,
  createClaimCode,
  hashCampaignPassCode,
  hashClaimCode,
  normalizeCampaignPassCode,
  normalizeClaimCode,
  verifyMetaSignature,
} from '../src/security.mjs';
import { ensureInstagramWebhookSubscription, extractInstagramMessages, extractInstagramReferrals } from '../src/instagram.mjs';

test('claim and campaign pass codes normalize and hash deterministically', () => {
  const code = createClaimCode();
  assert.match(code, /^PRI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(normalizeClaimCode(`  ${code.toLowerCase()}  `), code);
  assert.equal(hashClaimCode('secret', code), hashClaimCode('secret', code.toLowerCase()));

  const pass = createCampaignPassCode();
  assert.match(pass, /^A2Z-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(normalizeCampaignPassCode(` ${pass.toLowerCase()} `), pass);
  assert.equal(hashCampaignPassCode('secret', pass), hashCampaignPassCode('secret', pass.toLowerCase()));
});

test('short-lived QR pass can be consumed once and binds one Instagram identity', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  const passHash = hashCampaignPassCode('secret', 'A2Z-ABCD-2345');
  store.issueCampaignPass({ campaignId: 'a2z', passHash, ttlMs: 60_000 });

  const first = store.consumeCampaignPass({ passHash, instagramScopedId: 'ig-1' });
  assert.equal(first.status, 'consumed');
  assert.equal(first.campaignId, 'a2z');

  const same = store.consumeCampaignPass({ passHash, instagramScopedId: 'ig-1' });
  assert.equal(same.status, 'already_consumed_by_identity');

  const other = store.consumeCampaignPass({ passHash, instagramScopedId: 'ig-2' });
  assert.equal(other.status, 'used');
  store.close();
});

test('expired QR pass fails closed', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  const passHash = hashCampaignPassCode('secret', 'A2Z-ABCD-2345');
  store.issueCampaignPass({ campaignId: 'a2z', passHash, ttlMs: -1 });
  assert.equal(store.consumeCampaignPass({ passHash, instagramScopedId: 'ig-1' }).status, 'expired');
  store.close();
});

test('one Instagram identity gets one claim per campaign and cannot redeem twice', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  store.upsertParticipant({ instagramScopedId: 'ig-1', username: 'student', followsBusiness: false });
  store.recordAttribution({
    instagramScopedId: 'ig-1',
    campaignId: 'a2z',
    refCode: 'qr-pass:test',
    source: 'QR_PASS',
  });

  const firstCode = 'PRI-ABCD-2345';
  const first = store.issueOrRotateClaim({
    campaignId: 'a2z', instagramScopedId: 'ig-1', codeHash: hashClaimCode('s', firstCode), followsBusiness: false,
  });
  assert.equal(first.status, 'issued');

  const secondCode = 'PRI-EFGH-6789';
  const second = store.issueOrRotateClaim({
    campaignId: 'a2z', instagramScopedId: 'ig-1', codeHash: hashClaimCode('s', secondCode), followsBusiness: true,
  });
  assert.equal(second.status, 'rotated');
  assert.equal(second.claimId, first.claimId);

  assert.equal(store.redeemByCodeHash({ codeHash: hashClaimCode('s', firstCode) }).status, 'invalid');
  const redemption = store.redeemByCodeHash({ codeHash: hashClaimCode('s', secondCode) });
  assert.equal(redemption.status, 'redeemed');
  assert.equal(redemption.sourceVerified, true);
  assert.equal(store.redeemByCodeHash({ codeHash: hashClaimCode('s', secondCode) }).status, 'already_redeemed');

  const after = store.issueOrRotateClaim({
    campaignId: 'a2z', instagramScopedId: 'ig-1', codeHash: hashClaimCode('s', 'PRI-JKLM-3456'), followsBusiness: false,
  });
  assert.equal(after.status, 'already_redeemed');
  assert.equal(store.getStats('a2z').claims, 1);
  assert.equal(store.getStats('a2z').redeemed, 1);
  store.close();
});

test('Meta referral still attributes an Instagram-scoped identity when delivered', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'reward' });
  const campaign = store.getCampaignByRef('pri-a2z-qr-2026');
  assert.equal(campaign.id, 'a2z');
  store.recordAttribution({
    instagramScopedId: 'ig-ref-1',
    campaignId: campaign.id,
    refCode: 'pri-a2z-qr-2026',
    source: 'IGME',
  });
  assert.equal(store.getAttributedCampaign('ig-ref-1').id, 'a2z');
  assert.equal(store.getAttributedCampaign('different-user'), null);
  store.close();
});

test('different Instagram identities can each claim once', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'reward' });
  for (const id of ['ig-a', 'ig-b']) {
    store.upsertParticipant({ instagramScopedId: id });
    const result = store.issueOrRotateClaim({
      campaignId: 'a2z',
      instagramScopedId: id,
      codeHash: hashClaimCode('s', `PRI-${id === 'ig-a' ? 'ABCD-2345' : 'EFGH-6789'}`),
    });
    assert.equal(result.status, 'issued');
  }
  assert.equal(store.getStats('a2z').claims, 2);
  store.close();
});

test('Meta webhook signature is verified with HMAC SHA-256', () => {
  const body = Buffer.from('{"object":"instagram"}');
  const secret = 'meta-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyMetaSignature(secret, body, signature), true);
  assert.equal(verifyMetaSignature(secret, Buffer.from('tampered'), signature), false);
});

test('Instagram webhook parser extracts messages and tracked referrals', () => {
  const payload = {
    entry: [{ messaging: [
      {
        sender: { id: '123' },
        referral: { ref: 'pri-a2z-qr-2026', source: 'IGME', type: 'OPEN_THREAD' },
      },
      { sender: { id: '123' }, message: { mid: 'm1', text: ' A2Z ' } },
      { sender: { id: '999' }, message: { mid: 'm2', text: 'ignore', is_echo: true } },
    ] }],
  };
  assert.deepEqual(extractInstagramMessages(payload), [{ senderId: '123', text: 'A2Z', messageId: 'm1' }]);
  assert.deepEqual(extractInstagramReferrals(payload), [{
    senderId: '123', ref: 'pri-a2z-qr-2026', source: 'IGME', type: 'OPEN_THREAD',
  }]);
});

test('Instagram webhook subscription requests messages and messaging_referral', async () => {
  let capturedUrl = null;
  let capturedOptions = null;
  const fetchImpl = async (url, options) => {
    capturedUrl = new URL(url);
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      async json() { return { success: true }; },
    };
  };

  const result = await ensureInstagramWebhookSubscription({
    accountId: '17841400000000000',
    accessToken: 'test-token',
    apiVersion: 'v24.0',
    fetchImpl,
  });

  assert.equal(result.success, true);
  assert.equal(capturedUrl.hostname, 'graph.instagram.com');
  assert.equal(capturedUrl.pathname, '/v24.0/17841400000000000/subscribed_apps');
  assert.equal(capturedUrl.searchParams.get('subscribed_fields'), 'messages,messaging_referral');
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-token');
});
