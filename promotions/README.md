# Pri Learning Promotions — A2Z one-time reward

This is a deliberately isolated online service for physical-store promotions. It does **not** change Pri Learning's local-first learning backend.

## Customer flow

1. The printed QR opens `GET /c/a2z`.
2. The customer follows `@pri.learning`.
3. The page opens a tracked Instagram DM link for `@pri.learning` with `ref=pri-a2z-qr-2026`.
4. Meta can deliver that campaign value through the `messaging_referral` webhook; the service stores the Instagram-scoped identity → A2Z attribution.
5. The customer sends `A2Z` to complete the messaging interaction.
6. The service fetches the Instagram user profile and requires `is_user_follow_business === true` before a claim can be issued.
7. A claim code is issued only when the same Instagram-scoped identity has both the verified A2Z referral and a verified follow. Knowing or sharing the keyword alone is not enough.
8. A2Z staff redeems the code once at `GET /staff`.
9. After redemption, the same Instagram-scoped identity can never receive another reward for the A2Z campaign, even if it later unfollows and follows again.

The QR referral proves that the Instagram conversation entered through the A2Z campaign. The follow check proves that the same Instagram identity currently follows `@pri.learning` when the claim is created. Instagram does not provide a reliable way to prove that the act of following itself was caused by the QR code, so the system combines campaign attribution + current follow verification.

## Integrity and security

- Unique `(campaign_id, instagram_scoped_id)` database constraint.
- Tracked `ig.me` campaign referral is required for production eligibility; the public keyword alone cannot mint a claim.
- Follow state must be positively verified before claim issuance. If profile lookup fails or follow state is unavailable/false, the service fails closed and issues no code.
- Only the configured campaign keyword triggers claim verification after attribution.
- Atomic SQLite `BEGIN IMMEDIATE` redemption transaction.
- HMAC-SHA256 hashed claim codes; raw codes are not stored.
- Meta `X-Hub-Signature-256` verification.
- Staff PIN and redemption rate limiting.
- Audit events for attribution, issuance, rotation, invalid redemption, repeat redemption, and successful redemption.
- No Instagram scraping and no Instagram password collection.

## Local test

Requires Node 22.5+ because the service uses built-in `node:sqlite`.

```bash
cd promotions
npm test
STAFF_PIN=2468 CLAIM_SECRET=dev-secret node src/server.mjs
```

Verify that a non-follower cannot receive a code:

```bash
curl -s http://localhost:8787/dev/simulate \
  -H 'content-type: application/json' \
  -d '{"pin":"2468","instagramScopedId":"demo-001","username":"demo_student","followsBusiness":false}'
```

That returns `{"status":"not_following"}` with no code. Then simulate the same identity after following:

```bash
curl -s http://localhost:8787/dev/simulate \
  -H 'content-type: application/json' \
  -d '{"pin":"2468","instagramScopedId":"demo-001","username":"demo_student","followsBusiness":true}'
```

The simulator intentionally bypasses Meta attribution so the eligibility and redemption path can be exercised locally. Open `http://localhost:8787/staff`, redeem the returned code, and verify that a second redemption is rejected. Simulating the same identity as a follower again after redemption must return `already_redeemed` and no new code.

## Meta / Instagram setup for @pri.learning

1. Ensure `@pri.learning` is an Instagram Professional account (Business or Creator).
2. Create a Meta app and add **Instagram API with Instagram Login**.
3. Grant `instagram_business_basic` and `instagram_business_manage_messages`.
4. Add/authorize `@pri.learning` and obtain the Instagram account ID and access token.
5. Configure the callback as `https://<your-host>/webhooks/instagram` with your `META_VERIFY_TOKEN`.
6. Subscribe the Instagram account to `messages` and `messaging_referral`.
7. Set `META_APP_SECRET` so POST callbacks are verified using `X-Hub-Signature-256`.
8. Deploy with the variables in `.env.example`.
9. Print a QR for `https://<your-host>/c/a2z`.
10. Give A2Z staff only the `/staff` URL and staff PIN.

## Production notes

- Use HTTPS and a durable volume for `PROMOTIONS_DB_PATH`.
- Keep one writer instance while SQLite is used. Move the same schema to Postgres before horizontal scaling.
- Back up the database.
- Generate a long random `CLAIM_SECRET`; changing it invalidates outstanding codes.
- Never commit `INSTAGRAM_ACCESS_TOKEN`, `META_APP_SECRET`, `CLAIM_SECRET`, or the real staff PIN.
- A completely different Instagram account is a different identity. If abuse becomes material, add verified phone-number binding as a second uniqueness factor.
