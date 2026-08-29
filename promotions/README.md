# Pri Learning Promotions — A2Z one-time reward

This isolated service powers the A2Z × Pri Learning in-store campaign without changing Pri Learning's learning backend.

## Production customer flow

1. The printed table QR opens `GET /c/a2z`.
2. The page generates a one-time A2Z verification code, valid for 24 hours and usable once.
3. The customer copies that code into the `@pri.learning` Instagram DM. Case, spaces and dashes are ignored on the way back in, so a code typed by hand still verifies.
4. The Instagram webhook supplies the Instagram-scoped sender identity.
5. The backend binds the A2Z pass to that identity and creates at most one campaign claim for that identity.
6. Instagram replies with a private `/claim/PRI-...` link.
7. The customer follows `@pri.learning`.
8. At the counter, the customer opens the private claim link and taps **Verify follow & show green tick**.
9. In production, the backend performs a fresh Meta User Profile lookup for that Instagram-scoped identity. A live green tick is allowed only when `is_user_follow_business === true`.
10. If the current follow state is `false`, the claim remains unredeemed, the counter stays unchanged, and the customer is told to follow and retry.
11. If Meta cannot positively return the current follow relationship, the system fails closed: no green tick, no redemption, no counter increment.
12. If the current follow is confirmed and the identity has never redeemed before, the backend atomically redeems the claim, increments the campaign redemption counter, and returns a 60-second live green screen.
13. The shopkeeper only needs to look at the customer's phone. A valid screen says **VALID — GIVE 1 TOFFEE** and shows **GREEN TICK #N**.
14. After 60 seconds the live green screen closes. Reopening or redeeming the same claim shows **ALREADY USED**.
15. Once an Instagram identity has redeemed this campaign, scanning again, unfollowing, or following again can never create another reward for that same Instagram identity.

## Follow-state behaviour

Meta's Instagram User Profile API exposes `is_user_follow_business` for supported Instagram-scoped messaging identities. The customer green-tick endpoint refreshes that relationship at redemption time.

Production deliberately does not trust a cached follow state. If the fresh lookup fails or does not positively confirm the follow, the reward is not redeemed. Development tests use simulated stored follow state only so the gate can be exercised deterministically.

The permanent anti-repeat guarantee does not require an unfollow/refollow webhook. The Instagram-scoped identity is the durable campaign identity. Once `(campaign_id, instagram_scoped_id)` has a `redeemed_at` value, later unfollow/refollow cycles cannot reset eligibility.

## Why the shopkeeper does almost nothing

The shopkeeper does not type codes, scan QR codes, enter a PIN for each customer, or manually inspect Instagram. The customer's device performs the final live follow check and one-time redemption.

For basic screenshot resistance, a successful result is live for only 60 seconds, displays a ticking live indicator/server-adjusted clock, and then closes. A repeated request for the same claim returns **ALREADY USED**.

The older `/staff` scanner/manual redemption tools remain available as an operational fallback, but they are no longer the primary counter flow.

## Integrity and security

- Unique `(campaign_id, instagram_scoped_id)` claim constraint.
- Short-lived A2Z QR pass binds one campaign visit to one Instagram identity.
- A consumed QR pass cannot be transferred to another Instagram identity.
- Fresh follow confirmation required before customer green-tick redemption.
- Follow lookup failure is fail-closed in production.
- Atomic SQLite `BEGIN IMMEDIATE` redemption.
- HMAC-SHA256 claim-code hashes; raw claim codes are not stored.
- Meta `X-Hub-Signature-256` webhook verification.
- Public redemption endpoint is rate-limited and requires a high-entropy active claim code.
- Campaign redemption count is calculated from successfully redeemed database claims.
- Repeated redemption returns `already_redeemed` and never increments the counter again.
- No Instagram password collection and no scraping.

## Public routes

- Campaign QR page: `/c/a2z`
- Customer reward page: `/claim/<PRI-CODE>`
- Customer status API: `/api/customer/status`
- Follow-gated customer atomic redemption API: `/api/customer/redeem`
- Optional staff fallback: `/staff`
- Privacy Policy: `/privacy`
- User Data Deletion Instructions: `/data-deletion`
- Promotion Terms: `/terms`
- Health diagnostics: `/health`

## Meta / Instagram setup

The service uses the Pri Learning-owned professional account `@pri.learning` with:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `messages` webhook
- `messaging_referral` webhook when Meta delivers it
- User Profile lookup including `is_user_follow_business`

The short-lived QR-pass flow does not depend on `messaging_referral`, because ordinary Instagram message delivery has proven more reliable for the A2Z flow.

## Local test

Requires Node 22.5+ because the service uses built-in `node:sqlite`.

```bash
cd promotions
npm test
STAFF_PIN=2468 CLAIM_SECRET=dev-secret node src/server.mjs
```

## Production notes

- Use HTTPS and the durable Railway volume for `PROMOTIONS_DB_PATH`.
- Keep one writer instance while SQLite is used; move the same schema to Postgres before horizontal scaling.
- Back up the promotion database.
- Never rotate `CLAIM_SECRET` while outstanding claims matter; rotation invalidates their codes.
- Never commit Instagram access tokens, Meta app secrets, claim secrets, or real staff PINs.
- A completely different Instagram account is a different identity. If multi-account abuse becomes material, add a second uniqueness factor such as a verified phone number.
- A follow-gated reward may carry Instagram/Meta policy and App Review risk. Do not misrepresent the follow gate in App Review materials; validate the promotion structure against current Meta promotion/engagement rules before commercial launch.
