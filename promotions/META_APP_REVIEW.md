# Meta production launch pack — A2Z × Pri Learning

This file is the operator checklist and copy-ready review material for moving the Instagram promotion from Development mode to public customer use without adding a personal Instagram account.

## Current production URLs

Base URL:

`https://adequate-motivation-production-9a2f.up.railway.app`

Use these in the Meta dashboard:

- Primary site / campaign: `https://adequate-motivation-production-9a2f.up.railway.app/c/a2z`
- Privacy Policy URL: `https://adequate-motivation-production-9a2f.up.railway.app/privacy`
- User Data Deletion Instructions URL: `https://adequate-motivation-production-9a2f.up.railway.app/data-deletion`
- Terms URL: `https://adequate-motivation-production-9a2f.up.railway.app/terms`
- Instagram webhook callback: `https://adequate-motivation-production-9a2f.up.railway.app/webhooks/instagram`
- Health diagnostics: `https://adequate-motivation-production-9a2f.up.railway.app/health`

The privacy/deletion/terms URLs are public, HTTPS, unauthenticated and crawlable. `/robots.txt` explicitly allows crawlers.

## Policy-safe promotion design

The reward is attached to the tracked A2Z campaign interaction, **not to an Instagram follow**.

Customer flow:

1. Customer scans the A2Z QR.
2. The campaign page opens a tracked Instagram DM link.
3. Meta delivers the customer Instagram-scoped sender identity and the A2Z `messaging_referral` value.
4. Customer sends `A2Z`.
5. If that identity has the verified A2Z referral and has not already redeemed, Pri Learning sends one claim code.
6. A2Z staff redeem the code once.
7. The customer is welcome to follow `@pri.learning`, but following is optional and does not affect eligibility.

This avoids exchanging an item of monetary value for platform engagement. If Meta exposes a follow-relationship signal during profile lookup, it is treated only as optional campaign-engagement information and is not used to approve or deny the reward.

## Access strategy

The app serves only the Pri Learning professional account `@pri.learning`, which Pri Learning owns/manages. Meta's current Instagram API documentation distinguishes access level by the **professional account being served**:

- Standard Access: professional accounts you own/manage and have added in the App Dashboard.
- Advanced Access: professional accounts you do not own/manage.

Therefore the least-privilege launch path is:

1. Keep `@pri.learning` as the only app-user/professional account.
2. Complete required app metadata and compliance URLs.
3. Switch the app from Development to Live if Meta permits the current Standard Access permissions in Live mode.
4. Test with an unrelated public Instagram customer account.
5. Only if Meta's dashboard or live test says `instagram_business_manage_messages` requires Advanced Access, submit that permission for App Review using the material below.

Do not request broader access than the product needs.

## Required Instagram permissions

Request/retain only:

- `instagram_business_basic`
- `instagram_business_manage_messages`

Webhook subscriptions:

- `messages`
- `messaging_referral`

The service does not need content publishing, insights, ads, comments, follower-list scraping or a customer's Instagram password.

## App description

**Short description**

Pri Learning Promotions verifies one-time in-store A2Z rewards triggered by a tracked Instagram Direct interaction with the Pri Learning professional account.

**Detailed description**

A customer scans an A2Z in-store QR code. The QR opens a Pri Learning campaign page and a tracked Instagram Direct link for `@pri.learning`. When the customer sends the campaign keyword, the Instagram Messaging API supplies an Instagram-scoped identity and tracked referral. If the A2Z referral is verified and that identity has not already redeemed the campaign reward, the system sends a one-time claim code in Instagram Direct. A2Z staff redeem the code once. Following `@pri.learning` is optional and has no effect on reward eligibility. The service stores only the data required for campaign attribution, duplicate-claim prevention, redemption and security auditing.

## Permission justification — instagram_business_basic

Copy-ready text:

> Pri Learning uses `instagram_business_basic` only in connection with the Pri Learning-owned Instagram professional account and the minimum profile information Meta makes available for a customer-initiated Instagram messaging interaction. The service uses the Instagram-scoped identity to keep one promotion participant consistent across the A2Z campaign and prevent duplicate rewards. Any optional username/display-name or follow-relationship signal returned by Meta is used only for support or campaign measurement and is not used to determine reward eligibility. We do not use this permission for advertising, scraping, follower-list harvesting or unrelated profiling.

## Permission justification — instagram_business_manage_messages

Copy-ready text:

> Pri Learning uses `instagram_business_manage_messages` to operate a customer-initiated A2Z reward verification flow on the Pri Learning-owned professional account `@pri.learning`. A customer scans an A2Z QR code, opens a tracked Instagram Direct link and sends the campaign keyword. We receive the `messages` and `messaging_referral` webhook events, bind the Instagram-scoped sender identity to the A2Z referral, and send the customer either an attribution instruction or a one-time claim code. The conversation is always initiated by the Instagram user. The reward is not conditional on following, liking, sharing or other Instagram engagement. The permission is not used for unsolicited messaging, bulk messaging, scraping or advertising.

## Reviewer test instructions

1. Open `https://adequate-motivation-production-9a2f.up.railway.app/c/a2z` on a phone.
2. Tap **Open A2Z verification DM**.
3. The Instagram conversation opens through the tracked `ig.me` referral.
4. Send `A2Z`.
5. Expected result: Pri Learning replies with `A2Z QR verified` and a one-time code in the format `PRI-XXXX-XXXX`.
6. Open `https://adequate-motivation-production-9a2f.up.railway.app/staff`, enter the supplied reviewer/staff PIN and the claim code, then redeem it.
7. Expected result: the staff page reports a valid A2Z QR source and marks the reward permanently redeemed.
8. Send `A2Z` again from the same Instagram identity.
9. Expected result: no second reward is issued; the reply states that the campaign reward has already been redeemed.
10. Optional: visit/follow `@pri.learning`. This does not alter any of the outcomes above.

### Negative case

1. Open the `@pri.learning` conversation directly without using the A2Z tracked link.
2. Send `A2Z`.
3. Expected result: no claim code is issued; the bot tells the user to enter through the official A2Z QR link.

## Screencast script

Record one continuous phone/browser screencast with no secrets visible:

1. Show `/c/a2z` and the customer steps, including the statement that following is optional.
2. Tap **Open A2Z verification DM**.
3. Show Instagram's notice that the conversation was opened from a link.
4. Send `A2Z`.
5. Show the automatic `A2Z QR verified` response and one-time code.
6. Open `/staff` in a browser. Do **not** expose the real production PIN in the submitted video; use a temporary reviewer PIN for the review window if Meta requires staff-side verification.
7. Redeem the code and show the green success state.
8. Return to Instagram and send `A2Z` again.
9. Show the already-redeemed response.
10. Briefly show `/privacy`, `/data-deletion` and `/terms`.

## Dedicated review account — no personal Instagram required

If Meta requires a role/test account while the app is still in Development mode, create a dedicated account such as `pri.a2z.review` solely for app review/testing. Add **that account**, not a personal account, as an Instagram Tester and accept the invite from the dedicated account. Remove it after the app is Live if no longer needed.

The business account remains `@pri.learning`; the dedicated review account represents only the customer side of the flow.

## Dashboard checklist

Before switching Live or submitting review:

- App icon is final Pri Learning branding, not a placeholder.
- App category and contact details are filled.
- App domain / primary site points at the production Railway domain (or a final custom domain if one is added later).
- Privacy Policy URL is `/privacy`.
- User Data Deletion Instructions URL is `/data-deletion`.
- Terms URL is `/terms` if Meta exposes that field.
- Instagram API with Instagram Login is the selected integration.
- `@pri.learning` is added/authorized as the professional account.
- Required permissions are present: `instagram_business_basic`, `instagram_business_manage_messages`.
- Webhook callback is `/webhooks/instagram` with the existing verify token.
- Webhook subscription includes `messages` and `messaging_referral`.
- Railway `/health` reports `instagramWebhookSubscription: "subscribed"`.
- Customer/reviewer copy does not state or imply that a follow is required for the reward.
- No access tokens, app secrets, verify tokens, claim secrets or staff PINs appear in screenshots/screencasts.

## Live-mode acceptance test

After the Meta app is switched to Live, use a completely unrelated Instagram consumer account that has **no app role**:

1. Open the tracked A2Z campaign link.
2. Send `A2Z`.
3. Refresh `/health` and confirm `lastWebhookAt`, `lastReferralAt` and `lastMessageAt` are non-null/recent.
4. Confirm the automatic claim response arrives.
5. Redeem it once.
6. Confirm a second claim is rejected.
7. Confirm the same flow succeeds whether or not that customer follows `@pri.learning`.

Do not print permanent store QR material until this unrelated-account test passes.
