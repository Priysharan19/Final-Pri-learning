import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PromotionsStore } from '../src/store.mjs';
import { createClaimCode, hashClaimCode, normalizeClaimCode, verifyMetaSignature } from '../src/security.mjs';
import { extractInstagramMessages, extractInstagramReferrals } from '../src/instagram.mjs';

test('claim codes are normalized and hash deterministically', () => {
  const code = createClaimCode();
  assert.match(code, /^PRI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(normalizeClaimCode(`  ${code.toLowerCase()}  `), code);
  assert.equal(hashClaimCode('secret', code), hashClaimCode('secret', code.toLowerCase()));
});

test('one Instagram identity gets one claim per campaign and cannot redeem twice', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  store.upsertParticipant({ instagramScopedId: 'ig-1', username: 'student', followsBusiness: false });

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
  assert.equal(store.redeemByCodeHash({ codeHash: hashClaimCode('s', secondCode) }).status, 'redeemed');
  assert.equal(store.redeemByCodeHash({ codeHash: hashClaimCode('s', secondCode) }).status, 'already_redeemed');

  const after = store.issueOrRotateClaim({
    campaignId: 'a2z', instagramScopedId: 'ig-1', codeHash: hashClaimCode('s', 'PRI-JKLM-3456'), followsBusiness: false,
  });
  assert.equal(after.status, 'already_redeemed');
  assert.equal(store.getStats('a2z').claims, 1);
  assert.equal(store.getStats('a2z').redeemed, 1);
  store.close();
});

test('QR referral attributes an Instagram-scoped identity to the A2Z campaign', () => {
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
