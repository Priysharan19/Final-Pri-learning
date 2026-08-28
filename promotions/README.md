# Pri Learning Promotions — A2Z one-time reward

This is a deliberately isolated online service for physical-store promotions. It does **not** change Pri Learning's local-first learning backend.

## Customer flow

1. The printed QR opens `GET /c/a2z`.
2. The page opens a tracked Instagram DM link for `@pri.learning` with `ref=pri-a2z-qr-2026`.
3. Meta can deliver that campaign value through the `messaging_referral` webhook; the service stores the Instagram-scoped identity → A2Z attribution.
4. The customer sends `A2Z` to complete the messaging interaction.
5. A claim code is issued only if that same Instagram-scoped identity has the verified A2Z referral and has not already redeemed the campaign. Knowing or sharing the keyword alone is not enough.
6. A2Z staff redeems the code once at `GET /staff`.
7. After redemption, the same Instagram-scoped identity can never receive another reward for the A2Z campaign.
8. The customer may choose to follow `@pri.learning`, but following is optional and does not affect reward eligibility.

The QR referral proves that the Instagram conversation entered through the A2Z campaign. The Instagram-scoped sender identity is the durable campaign identity used for one-time redemption. The service may observe the follow-relationship signal Meta exposes for a messaging participant, but that signal is optional engagement information only and is not used as the condition for the reward.

## Why the reward is not follow-gated

The production flow intentionally does **not** exchange a toffee or other item of value for a follow. Meta's spam/engagement policies restrict exchanging things of monetary value for engagement such as follows. Keeping the reward tied to the tracked A2Z campaign interaction rather than to the follow makes the promotion materially safer for public Instagram use and App Review. The landing page can still invite customers to visit and follow `@pri.learning` voluntarily.

## Integrity and security

- Unique `(campaign_id, instagram_scoped_id)` database constraint.
- Tracked `ig.me` campaign referral is required for production eligibility; the public keyword alone cannot mint a claim.
- Only the configured campaign keyword triggers claim issuance after attribution.
- Optional profile/follow lookup is non-blocking; a Meta profile lookup outage cannot create a duplicate reward or prevent an otherwise valid A2Z claim.
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

Create a simulated claim without Meta credentials:

```bash
curl -s http://localhost:8787/dev/simulate \
  -H 'content-type: application/json' \
  -d '{"pin":"2468","instagramScopedId":"demo-001","username":"demo_student","followsBusiness":false}'
```

A code is issued even when `followsBusiness` is false because the follow is not the reward gate. Re-running the simulator for the same identity before redemption rotates the outstanding code rather than creating a second reward. After redemption, the same identity always returns `already_redeemed` with no new code.

## Public compliance pages

- Privacy Policy: `/privacy`
- User Data Deletion Instructions: `/data-deletion`
- Promotion Terms: `/terms`
- Crawler policy: `/robots.txt`
- Meta launch/App Review pack: `META_APP_REVIEW.md`

## Meta / Instagram setup for @pri.learning

1. Ensure `@pri.learning` is an Instagram Professional account (Business or Creator).
2. Create a Meta app and add **Instagram API with Instagram Login**.
3. Grant `instagram_business_basic` and `instagram_business_manage_messages`.
4. Add/authorize `@pri.learning` and obtain the Instagram account ID and access token.
5. Configure the callback as `https://<your-host>/webhooks/instagram` with your `META_VERIFY_TOKEN`.
6. Subscribe the Instagram account to `messages` and `messaging_referral`.
7. Set `META_APP_SECRET` so POST callbacks are verified using `X-Hub-Signature-256`.
8. Deploy with the variables in `.env.example`.
9. Fill Meta app metadata with the public Privacy Policy and User Data Deletion URLs.
10. Move the Meta app from Development to Live for public customers, using the least-privilege access level Meta permits for the Pri Learning-owned professional account.
11. Print a QR for `https://<your-host>/c/a2z` only after an unrelated public Instagram account passes the live acceptance test.
12. Give A2Z staff only the `/staff` URL and staff PIN.

## Production notes

- Use HTTPS and a durable volume for `PROMOTIONS_DB_PATH`.
- Keep one writer instance while SQLite is used. Move the same schema to Postgres before horizontal scaling.
- Back up the database.
- Generate a long random `CLAIM_SECRET`; changing it invalidates outstanding codes.
- Never commit `INSTAGRAM_ACCESS_TOKEN`, `META_APP_SECRET`, `CLAIM_SECRET`, or the real staff PIN.
- A completely different Instagram account is a different identity. If abuse becomes material, add verified phone-number binding as a second uniqueness factor.
