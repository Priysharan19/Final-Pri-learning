// The web billing adapter for an edition (plan E5, and Stripe for the
// Australian edition): Razorpay where the edition's billing table lists it,
// Stripe where it lists Stripe. Both answer the same verifiers/checkout/
// lifecycle contract that billing.js consumes under the `web` route family.
import { createRazorpayBilling } from './razorpay.js';
import { createStripeBilling } from './stripe.js';
import { webProviderOf } from './billingProviders.js';
import { serverEdition } from './edition.js';

export function createWebBilling(db, { edition = serverEdition(process.env), ...options } = {}) {
  // An edition with no web provider keeps the (inert, edition-gated) Razorpay
  // adapter that every deployment has always carried; the route gate in
  // billing.js answers 404 before it is reached.
  return webProviderOf(edition) === 'stripe' ? createStripeBilling(db, options) : createRazorpayBilling(db, options);
}
