// Where a hosted web checkout may live, by the provider the SERVER says this
// deployment sells through (GET /v1/billing/config → webCheckout.provider).
// Razorpay's hosted page is rzp.io; Stripe's is checkout.stripe.com. A checkout
// answer must name the same provider the server's configuration named, over
// https, on that provider's own host — anything else is refused before the
// browser leaves the app (Priyabhata never opens Stripe, Prithagoras never
// opens Razorpay).
const HOSTS = Object.freeze({ razorpay: 'rzp.io', stripe: 'checkout.stripe.com' });

/** The URL to open, or null when the answer is not an acceptable hosted checkout. */
export function acceptedCheckoutUrl(configuredProvider, checkout) {
  const provider = String(checkout?.checkoutProvider || '');
  if (!configuredProvider || provider !== configuredProvider || !Object.hasOwn(HOSTS, provider)) return null;
  try {
    const url = new URL(String(checkout?.checkoutUrl || ''));
    return url.protocol === 'https:' && url.hostname === HOSTS[provider] && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}
