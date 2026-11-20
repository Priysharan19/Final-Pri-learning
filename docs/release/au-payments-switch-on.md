# Australian payments: what switching on takes (HSC Pass)

Status, 19 November 2026: DRAFT checklist. Nothing here is switched on. Australian payments stay OFF behind the existing switch (the Prithagoras edition's Stripe provider is not configured, so `billingProviders.js` reports it unconfigured and no checkout opens). The owner is asked at the moment of switching on; no one else turns it on.

## What is built and what is not (this branch)

Built, with tests, and not connected to checkout:

- The offer arithmetic: `client/src/engine/hscPass.js`, `client/test/hsc-pass-check.mjs`. HSC Pass monthly A$9.99; HSC Pass to the exams A$69, one payment, no renewal, ending the day after the last HSC Mathematics exam of its exam year; the price steps down by whole months below six months to a A$19 floor; the exact price and end date are stated before purchase.
- The pass in the entitlement lifecycle: `server/platform/hscPassGrant.js` (`grantHscPass`, `revokeHscPass`), tested by `server/test/hsc-pass-grant-check.mjs`. It is a dated grant of Premium on the existing support-grant mechanism (no schema change): idempotent per payment reference, ends at the configured end instant (the last paid millisecond is the end minus one), never renews, never shortens a longer source, and a full refund removes it at once. The purchase day is the Sydney date (`passOfferAt`). Nothing calls it yet.
- The product rules for the papers: PDFs free for any signed-in account; sitting Paper 01 free; sitting the other twelve, the practice plan and the unseen re-test need `premium-exams`, decided by the server's own entitlement row (`paperAttempts.js`).

NOT built, and needed before the switch (each is a change to a security or commerce surface and needs its own reviewed change):

1. The Stripe side of the one-off purchase: a payment-mode Checkout session whose price the SERVER chooses (`passOfferAt`), a webhook branch that, on a verified `checkout.session.completed` (mode payment, paid), calls `grantHscPass`, and, on a verified full `charge.refunded` of that payment, calls `revokeHscPass`. The grant and the refund rule are built; the session and the webhook branch are not, and they need a place to record the payment-to-account binding (billing_payments requires a subscription id today, so a payment-only row needs a reviewed schema change).
2. Paywall copy that names the tier "HSC Pass", lists the two ways to buy, and shows the exact price and end date before purchase (copy in `strings.en.js`; tests in `paywall-honesty-check.mjs` and `value-packaging-check.mjs`).
3. Terms and refund text for a non-renewing pass in `docs/legal/au/` and its checks (`packaging-check` holds the three prices equal); Priyabhata (India) unchanged.
4. The Australian terms and refund policy reviewed by counsel (see `docs/legal/au/SUMMARY-FOR-OWNER.md`).

## The owner's list, in order

1. Confirm the 2027 end date. The 2027 HSC written exam timetable was not published on 19 Nov 2026 (NESA page: https://educationstandards.nsw.edu.au/wps/portal/nesa/about/key-dates/hsc-key-dates/written-exam-timetable). `hscPass.js` carries 31 October 2027 as a PROVISIONAL last exam day. Set the real date and `provisional: false`, or the offer says "date to be confirmed by NESA".
2. Create the Stripe products and prices (live mode), in AUD. Stripe prices are immutable, so a new price means a new price object:
   - "HSC Pass, monthly": recurring, A$9.99 per month.
   - "HSC Pass to the exams": one-time. Because the price steps down by date, create one one-time price object per step (A$69, 58, 46, 35, 23, 19) and let the server choose the one `passOffer` returns for the purchase day, or create prices on demand through the API; do not let the client name a price.
3. Webhook: add the live endpoint for `/v1/billing/webhook/stripe`; subscribe to `checkout.session.completed`, `charge.refunded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` and `customer.subscription.deleted`; store the signing secret.
4. Environment on the Prithagoras production service only: `PRI_STRIPE_SECRET_KEY`, `PRI_STRIPE_WEBHOOK_SECRET`, `PRI_STRIPE_MONTHLY_PRICE_ID`, and the pass price ids once item 1 of the "not built" list exists. Secrets live in the host's environment, never in the repository or in chat.
5. Test-mode walk first (Stripe test keys, test card numbers), in this order: monthly purchase grants `premium-exams`; cancel keeps it to period end; the pass purchase grants it until `endsOn` and shows no renewal; a refund inside the refund policy ends the grant; a replayed or forged webhook changes nothing; a claim in a header or query changes nothing; the free account still downloads every PDF and sits only Paper 01.
6. What to verify after the live switch: one real small purchase by the owner, refunded; the entitlement row, the receipt, the end date shown on Settings, the Premium page copy, the legal pages, and the paywall-honesty checks on the deployed build.
7. Roll back: remove the Stripe environment variables and redeploy; the edition reports Stripe unconfigured and checkout closes. Existing grants stay valid until their dates.
