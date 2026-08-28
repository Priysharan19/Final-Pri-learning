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

This avoids requesting broader access than the product actually needs.

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

Pri Learning Promotions verifies one-time in-store A2Z rewards triggered by a tracked Instagram interaction with the Pri Learning professional account.

**Detailed description**

A customer scans an A2Z in-store QR code. The QR opens a Pri Learning campaign page and a tracked Instagram Direct link for `@pri.learning`. When the customer sends the campaign keyword, the Instagram Messaging API supplies an Instagram-scoped identity and the tracked referral. Pri Learning checks the profile signal supplied by Meta to confirm the same identity currently follows `@pri.learning`. If the A2Z referral and follow are both verified and that identity has not already redeemed the campaign reward, the system sends a one-time claim code in Instagram Direct. A2Z staff redeem the code once. The service stores only the data required for campaign attribution, follow verification, duplicate-claim prevention, redemption and security auditing.

## Permission justification — instagram_business_basic

Copy-ready text:

> Pri Learning uses `instagram_business_basic` only for the Pri Learning-owned Instagram professional account and for profile fields Meta exposes in an Instagram messaging interaction. After a customer initiates a Direct conversation with `@pri.learning`, our service uses the Instagram-scoped identity supplied by Meta to retrieve the minimum profile information needed for the promotion, such as the username/display name when available. The information is used only to identify the participant consistently for the A2Z campaign and support one-time reward verification. We do not use this permission for advertising, scraping, follower-list harvesting or unrelated profiling.

## Permission justification — instagram_business_manage_messages

Copy-ready text:

> Pri Learning uses `instagram_business_manage_messages` to operate a customer-initiated A2Z reward verification flow on the Pri Learning-owned professional account `@pri.learning`. A customer scans an A2Z QR code, opens a tracked Instagram Direct link and sends the campaign keyword. We receive the `messages` and `messaging_referral` webhook events, bind the Instagram-scoped sender identity to the A2Z referral, retrieve the follow-relationship signal Meta makes available for that messaging identity, and send the customer either an eligibility instruction, a verification failure message, or a one-time claim code. The conversation is always initiated by the Instagram user. The permission is not used for unsolicited messaging, bulk messaging, scraping or advertising.

## Reviewer test instructions

1. Open `https://adequate-motivation-production-9a2f.up.railway.app/c/a2z` on a phone.
2. Tap **Follow @pri.learning** and follow the Instagram account.
3. Return to the campaign page and tap **Continue to A2Z verification DM**.
4. The Instagram conversation opens through the tracked `ig.me` referral.
5. Send `A2Z`.
6. Expected result for an eligible account: Pri Learning replies with `Follow verified for @pri.learning` and a one-time code in the format `PRI-XXXX-XXXX`.
7. Open `https://adequate-motivation-production-9a2f.up.railway.app/staff`, enter the supplied reviewer/staff PIN and the claim code, then redeem it.
8. Expected result: the staff page reports a valid A2Z QR source and verified follow and marks the reward permanently redeemed.
9. Send `A2Z` again from the same Instagram identity.
10. Expected result: no second reward is issued; the reply states that the campaign reward has already been redeemed.

### Negative case

1. Use a fresh test identity that is not following `@pri.learning`.
2. Enter via the tracked A2Z DM link and send `A2Z`.
3. Expected result: no claim code is issued; the bot asks the user to follow `@pri.learning` first.

## Screencast script

Record one continuous phone/browser screencast with no secrets visible:

1. Show `/c/a2z` and the four customer steps.
2. Tap the Instagram profile button and visibly show the follow action.
3. Return and tap the tracked A2Z DM button.
4. Show Instagram's notice that the conversation was opened from a link.
5. Send `A2Z`.
6. Show the automatic response and one-time code.
7. Open `/staff` in a browser. Do **not** expose the real production PIN in the submitted video; use a temporary reviewer PIN for the review window if Meta requires staff-side verification.
8. Redeem the code and show the green success state.
9. Return to Instagram and send `A2Z` again.
10. Show the already-redeemed response.
11. Briefly show `/privacy` and `/data-deletion` so the reviewer can see the user-facing data practices.

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
- No access tokens, app secrets, verify tokens, claim secrets or staff PINs appear in screenshots/screencasts.

## Live-mode acceptance test

After the Meta app is switched to Live, use a completely unrelated Instagram consumer account that has **no app role**:

1. Open the tracked A2Z campaign link.
2. Follow `@pri.learning`.
3. Send `A2Z`.
4. Refresh `/health` and confirm `lastWebhookAt`, `lastReferralAt` and `lastMessageAt` are non-null/recent.
5. Confirm the automatic claim response arrives.
6. Redeem it once.
7. Confirm a second claim is rejected.

Do not print permanent store QR material until this unrelated-account test passes.
