# Pri Learning Promotions — A2Z one-time reward

This isolated service powers the A2Z × Pri Learning in-store campaign without changing Pri Learning's learning backend.

## Production customer flow

1. The printed table QR opens `GET /c/a2z`.
2. The page generates a short-lived one-time A2Z verification message.
3. The customer copies that message into the `@pri.learning` Instagram DM.
4. The Instagram webhook supplies the Instagram-scoped sender identity.
5. The backend binds the short-lived A2Z pass to that identity and creates at most one campaign claim for that identity.
6. Instagram replies with a private `/claim/PRI-...` link.
7. At the counter, the customer opens the link and taps **Show live green tick**.
8. The backend re-checks the current Instagram profile relationship signal where Meta makes it available, atomically redeems the one-time claim, increments the campaign redemption counter, and returns a 60-second live green screen.
9. The shopkeeper only needs to look at the customer's phone. A valid screen says **VALID — GIVE 1 TOFFEE** and shows **GREEN TICK #N**.
10. After 60 seconds the live green screen closes. Reopening or redeeming the same claim shows **ALREADY USED**.
11. Once an Instagram identity has redeemed this campaign, scanning again, unfollowing, or following again can never create another claim for that same Instagram identity.

## Follow-state behaviour

Meta's Instagram User Profile API can expose `is_user_follow_business` for an Instagram-scoped messaging identity. The service refreshes that current signal at customer redemption time and displays it on the live result where available.

The permanent anti-repeat guarantee does **not** depend on detecting an unfollow/refollow event. Meta gives the service the Instagram-scoped identity; the database keeps the one-redemption record against that identity permanently for the A2Z campaign. Therefore follow cycling cannot reset eligibility.

Following `@pri.learning` remains optional for reward eligibility. This keeps the promotion aligned with Instagram's guidance against exchanging money or giveaways for follows or other engagement. The current follow signal is campaign information only.

## Why the shopkeeper does almost nothing

The shopkeeper does not type codes, scan QR codes, enter a PIN for each customer, or operate the backend. The customer's device performs the final one-time redemption and shows the server-confirmed result.

For basic screenshot resistance, a successful result is live for only 60 seconds, displays a ticking live indicator/server-adjusted clock, and then closes. A repeated request for the same claim returns **ALREADY USED**.

The older `/staff` scanner/manual redemption tools remain available as an operational fallback, but they are no longer the primary counter flow.

## Integrity and security

- Unique `(campaign_id, instagram_scoped_id)` claim constraint.
- Short-lived A2Z QR pass binds one campaign visit to one Instagram identity.
- A consumed QR pass cannot be transferred to another Instagram identity.
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
- Customer atomic redemption API: `/api/customer/redeem`
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
