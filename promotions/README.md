# Pri Learning Promotions — A2Z one-time reward

This is a deliberately isolated online service for physical-store promotions. It does **not** change Pri Learning's local-first learning backend.

## What it does

- Campaign landing page: `GET /c/a2z`
- Instagram webhook verification: `GET /webhooks/instagram`
- Instagram message webhook: `POST /webhooks/instagram`
- One claim per Instagram-scoped identity per campaign
- Rotates an unredeemed code if the same user DMs again; older codes become invalid
- Permanently blocks a second claim after redemption, even if the user later unfollows/refollows
- Staff redemption UI: `GET /staff`
- Atomic one-time redemption backed by SQLite
- HMAC-hashed claim codes; raw codes are not stored
- Meta webhook HMAC verification
- No Instagram scraping or password collection

The campaign intentionally does **not** make the physical reward conditional on following. Follow state can be recorded as an optional engagement signal (`is_user_follow_business`) after the user messages the professional account.

## Local test

Requires Node 22.5+ because the service uses the built-in `node:sqlite` API.

```bash
cd promotions
npm test
STAFF_PIN=2468 CLAIM_SECRET=dev-secret node src/server.mjs
```

Create a simulated claim in development:

```bash
curl -s http://localhost:8787/dev/simulate \
  -H 'content-type: application/json' \
  -d '{"pin":"2468","instagramScopedId":"demo-001","username":"demo_student","followsBusiness":true}'
```

Then open `http://localhost:8787/staff` and redeem the returned code. A second redemption must be rejected.

## Meta / Instagram setup for @pri.learning

1. Ensure `@pri.learning` is an Instagram Professional account (Business or Creator).
2. Create a Meta app and add **Instagram API with Instagram Login**.
3. Grant the app `instagram_business_basic` and `instagram_business_manage_messages`.
4. Add/authorize the `@pri.learning` professional account and obtain its Instagram account ID and access token.
5. Subscribe the app to the Instagram `messages` webhook.
6. Set the callback URL to `https://<your-host>/webhooks/instagram` and choose a private `META_VERIFY_TOKEN`.
7. Set `META_APP_SECRET` so POST webhooks are verified with `X-Hub-Signature-256`.
8. Deploy with the variables in `.env.example`.
9. Print the QR code for `https://<your-host>/c/a2z`.
10. Give A2Z staff access to `https://<your-host>/staff` and the staff PIN only.

When a customer DMs exactly `A2Z`, the webhook uses the Instagram-scoped sender ID as the durable campaign identity. The service queries the User Profile API, stores the optional follow state, issues/rotates a code, and sends the code back by Instagram DM.

## Production notes

- Put the service behind HTTPS. Meta webhooks require a public HTTPS callback.
- Persist `PROMOTIONS_DB_PATH` on a durable volume; do not use ephemeral filesystem storage.
- Back up the SQLite database. `WAL` mode and `BEGIN IMMEDIATE` are used for safe one-time redemption on a single service instance.
- Run **one writer instance** when using SQLite. If the promotion grows to multiple service replicas or stores, migrate the same schema to Postgres before horizontal scaling.
- Use a long random `CLAIM_SECRET`; changing it invalidates all outstanding claim codes.
- Rotate the staff PIN if it is exposed.
- Never put `INSTAGRAM_ACCESS_TOKEN`, `META_APP_SECRET`, or `CLAIM_SECRET` in Git.
- A second Instagram account is a second identity. If abuse becomes meaningful, add verified phone-number binding as an additional uniqueness key.

## API behavior

### `POST /api/redeem`

Request:

```json
{"code":"PRI-ABCD-2345","pin":"<staff pin>"}
```

Possible outcomes:

- `200 {"status":"redeemed", ...}` — issue the reward.
- `409 {"status":"already_redeemed", ...}` — do not issue another reward.
- `404 {"status":"invalid"}` — do not issue a reward.
- `403 {"error":"invalid_staff_pin"}` — staff authentication failed.

### `POST /dev/simulate`

Development only. Creates or rotates a claim without Meta credentials so the full redemption path can be tested before the Meta app is approved/configured.
