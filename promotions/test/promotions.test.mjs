import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PromotionsStore } from '../src/store.mjs';
import {
  campaignPassCodeHashes,
  claimCodeHashes,
  createCampaignPassCode,
  createClaimCode,
  hashCampaignPassCode,
  hashClaimCode,
  isCampaignPassCode,
  isClaimCode,
  normalizeCampaignPassCode,
  normalizeClaimCode,
  parseCampaignPassMessage,
  verifyMetaSignature,
} from '../src/security.mjs';
import { ensureInstagramWebhookSubscription, extractInstagramMessages, extractInstagramReferrals } from '../src/instagram.mjs';

test('claim and campaign pass codes normalize and hash deterministically', () => {
  const code = createClaimCode();
  assert.match(code, /^PRI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  // The canonical form is the code without its dashes: that is what gets hashed,
  // so every sloppy spelling of one code lands on one row.
  assert.equal(normalizeClaimCode(`  ${code.toLowerCase()}  `), code.replace(/-/g, ''));

  const pass = createCampaignPassCode();
  assert.match(pass, /^A2Z-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(normalizeCampaignPassCode(` ${pass.toLowerCase()} `), pass.replace(/-/g, ''));
});

test('a code typed by hand verifies however it is spaced, cased or dashed', () => {
  const code = createClaimCode();                        // PRI-4K7M-92QX
  const body = code.replace(/-/g, '');                   // PRI4K7M92QX
  const spellings = [
    code,
    code.toLowerCase(),
    body,
    body.toLowerCase(),
    `  ${code}  `,
    code.replace(/-/g, ' '),                             // PRI 4K7M 92QX
    code.replace(/-/g, '\u2013'),                        // en-dashes from autocorrect
    `${body.slice(0, 3)} ${body.slice(3, 7)}-${body.slice(7)}`,
  ];
  const expected = hashClaimCode('secret', code);
  for (const spelling of spellings) {
    assert.equal(hashClaimCode('secret', spelling), expected, `hash differs for ${JSON.stringify(spelling)}`);
    assert.ok(isClaimCode(spelling), `shape rejected ${JSON.stringify(spelling)}`);
  }

  const pass = createCampaignPassCode();
  assert.equal(
    hashCampaignPassCode('secret', pass),
    hashCampaignPassCode('secret', pass.replace(/-/g, ' ').toLowerCase()),
  );

  // Forgiving about noise, not about content.
  for (const rubbish of ['', 'PRI', 'PRI-4K7M', 'PRI-4K7M-92QXX', 'XYZ-4K7M-92QX', 'PRI-4K7M-92Q0']) {
    assert.equal(isClaimCode(rubbish), false, `should have been rejected: ${JSON.stringify(rubbish)}`);
  }
});

test('the DM parser takes the code alone and still takes the old keyword form', () => {
  const pass = createCampaignPassCode();
  const body = pass.replace(/-/g, '');

  // What the page prints now.
  assert.deepEqual(parseCampaignPassMessage(pass, 'A2Z'), { passCode: body });
  assert.deepEqual(parseCampaignPassMessage(pass.toLowerCase(), 'A2Z'), { passCode: body });
  assert.deepEqual(parseCampaignPassMessage(` ${body.toLowerCase()} `, 'A2Z'), { passCode: body });

  // What a page opened before the change still prints, for the day its pass lives.
  assert.deepEqual(parseCampaignPassMessage(`A2Z ${pass}`, 'A2Z'), { passCode: body });
  assert.deepEqual(parseCampaignPassMessage(`a2z ${pass.toLowerCase()}`, 'A2Z'), { passCode: body });

  // The bare keyword is not a pass, and neither is a near miss.
  assert.equal(parseCampaignPassMessage('A2Z', 'A2Z'), null);
  assert.equal(parseCampaignPassMessage('', 'A2Z'), null);
  assert.equal(parseCampaignPassMessage(`A2Z ${pass}X`, 'A2Z'), null);
  assert.equal(parseCampaignPassMessage('hello there', 'A2Z'), null);
  assert.ok(isCampaignPassCode(pass));
});

test('generated codes avoid every character that has two readings', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const code = createClaimCode();
    assert.match(code, /^PRI-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    for (const character of code.replace(/^PRI-/, '').replace('-', '')) seen.add(character);
  }
  for (const confusable of ['0', 'O', '1', 'I', 'L']) {
    assert.equal(seen.has(confusable), false, `${confusable} should never be generated`);
  }
  // Rejection sampling must not quietly drop the tail of the alphabet: over
  // 16,000 characters every one of the 31 should have turned up.
  assert.equal(seen.size, 31, `expected all 31 characters, saw ${seen.size}`);
});

test('a pass hashed under the old normalisation is still consumable', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });

  // Exactly what the previous scheme wrote: the dashes survived normalisation,
  // and L was still in the alphabet, so a live row can contain one.
  const legacyPassHash = createHmac('sha256', 'secret').update('campaign-pass:A2Z-ABCL-2345').digest('hex');
  store.issueCampaignPass({ campaignId: 'a2z', passHash: legacyPassHash });

  // The customer sends it the new, forgiving way — lower case, no dashes.
  const consumed = store.consumeCampaignPass({
    passHash: campaignPassCodeHashes('secret', 'a2z abcl 2345'),
    instagramScopedId: 'ig-legacy',
  });
  assert.equal(consumed.status, 'consumed');
  assert.equal(consumed.campaignId, 'a2z');

  // And it is still a one-shot pass afterwards.
  assert.equal(
    store.consumeCampaignPass({ passHash: campaignPassCodeHashes('secret', 'A2Z-ABCL-2345'), instagramScopedId: 'ig-other' }).status,
    'used',
  );
  store.close();
});

test('a claim hashed under the old normalisation is still redeemable', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  store.upsertParticipant({ instagramScopedId: 'ig-legacy', followsBusiness: true });
  const legacyCodeHash = createHmac('sha256', 'secret').update('PRI-ABCL-2345').digest('hex');
  store.issueOrRotateClaim({ campaignId: 'a2z', instagramScopedId: 'ig-legacy', codeHash: legacyCodeHash, followsBusiness: true });

  const redeemed = store.redeemByCodeHash({ codeHash: claimCodeHashes('secret', 'pri abcl 2345') });
  assert.equal(redeemed.status, 'redeemed');
  assert.equal(redeemed.rewardLabel, 'toffee');

  // Still exactly one redemption, whichever spelling asks a second time.
  assert.equal(store.redeemByCodeHash({ codeHash: claimCodeHashes('secret', 'PRI-ABCL-2345') }).status, 'already_redeemed');
  store.close();
});

test('new codes resolve on the canonical hash and never need the legacy one', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  store.upsertParticipant({ instagramScopedId: 'ig-new', followsBusiness: true });

  const code = createClaimCode();
  const candidates = claimCodeHashes('secret', code);
  // Canonical first — the legacy hashes are a fallback, never the primary key.
  assert.equal(candidates[0], hashClaimCode('secret', code));
  store.issueOrRotateClaim({ campaignId: 'a2z', instagramScopedId: 'ig-new', codeHash: candidates[0], followsBusiness: true });

  // Redeeming with the canonical hash alone is enough for a code issued today.
  assert.equal(store.redeemByCodeHash({ codeHash: hashClaimCode('secret', code) }).status, 'redeemed');
  store.close();
});

test('a QR pass can be consumed once and binds one Instagram identity', () => {
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

test('a QR pass issued with no explicit TTL lasts 24 hours', () => {
  const store = new PromotionsStore(':memory:');
  store.seedCampaign({ id: 'a2z', keyword: 'A2Z', refCode: 'pri-a2z-qr-2026', rewardLabel: 'toffee' });
  const before = Date.now();
  const { expiresAt } = store.issueCampaignPass({ campaignId: 'a2z', passHash: hashCampaignPassCode('secret', 'A2Z-ABCD-2345') });
  const lifetimeMs = Date.parse(expiresAt) - before;
  const DAY = 24 * 60 * 60 * 1000;
  assert.ok(lifetimeMs > DAY - 5_000 && lifetimeMs <= DAY, `expected ~24h, got ${lifetimeMs}ms`);
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
