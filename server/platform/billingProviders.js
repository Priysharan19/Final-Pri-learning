// Pri Learning · which payment providers an edition sells through (ADR-0002,
// plan E5).
//
// One table decides it: the `billing` block of each edition in
// client/edition.config.mjs. Priyabhata lists Razorpay, Apple and Google.
// Prithagoras lists none until the owner chooses an Australian provider
// (decision O2, plan H3), so on a Prithagoras server Premium is not on sale:
// /billing/config offers no price, product or checkout, every purchase route
// answers 404 BILLING_NOT_AVAILABLE_IN_EDITION before the billing router's own
// session check, rate limit or adapter, and a payment event for an unlisted
// provider is refused however well it is signed — an Australian server never
// applies an Indian payment. (The guardian-consent gate mounted in front of
// the billing router runs first: a child account awaiting consent is refused
// there, with the consent code. Account deletion still asks the web adapter
// to cancel a subscription; with no way to create one it finds none.)
//
// What an account already holds (an administrator's grant, a trial) is not a
// purchase and is untouched: /billing/status and /billing/manage still answer.
import { BILLING_PROVIDERS, editionOf } from '../../client/edition.config.mjs';

export const BILLING_NOT_AVAILABLE = 'BILLING_NOT_AVAILABLE_IN_EDITION';

// The billing routes name their provider by route family; the web family is
// Razorpay's (/checkout/web, /web/cancel, /restore/web, /webhook/web).
export const ROUTE_FAMILY_PROVIDER = Object.freeze({ web: 'razorpay', apple: 'apple', google: 'google' });

// The deployment variables that exist only to sell through one provider.
// Sign-in identifiers (PRI_APPLE_CLIENT_IDS, PRI_GOOGLE_CLIENT_IDS) are not
// here: signing in with Apple or Google is not a purchase.
const PROVIDER_VARIABLES = Object.freeze({
  razorpay: Object.freeze([
    'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
    'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_ANNUAL_PLAN_ID',
    'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT',
    'PRI_WEB_MONTHLY_PRICE_ID', 'PRI_WEB_ANNUAL_PRICE_ID'
  ]),
  apple: Object.freeze(['PRI_APPLE_MONTHLY_PRODUCT_ID', 'PRI_APPLE_ANNUAL_PRODUCT_ID']),
  google: Object.freeze([
    'PRI_GOOGLE_MONTHLY_PRODUCT_ID', 'PRI_GOOGLE_ANNUAL_PRODUCT_ID',
    'PRI_GOOGLE_SERVICE_ACCOUNT_JSON', 'PRI_GOOGLE_SERVICE_ACCOUNT_FILE',
    'PRI_GOOGLE_RTDN_AUDIENCE', 'PRI_GOOGLE_RTDN_SERVICE_ACCOUNT'
  ])
});

/** The edition's billing facts: { edition, providers, currency, available }. */
export function editionBilling(edition) {
  const record = editionOf(edition);
  const providers = record.billing.providers;
  return Object.freeze({ edition: record.id, providers, currency: record.billing.currency, available: providers.length > 0 });
}

/** Whether an edition sells through a provider, named by id or by route family. */
export function providerAllowed(edition, provider) {
  const id = Object.hasOwn(ROUTE_FAMILY_PROVIDER, provider) ? ROUTE_FAMILY_PROVIDER[provider] : provider;
  return editionBilling(edition).providers.includes(id);
}

/** The 404 a purchase route answers for a provider this edition does not sell through. */
export function billingNotAvailable(res) {
  return res.status(404).json({ error: { code: BILLING_NOT_AVAILABLE, message: 'Premium is not on sale in this edition yet.' } });
}

/**
 * Start-up problems, as strings for the configuration "missing" list:
 *  · a variable of a provider the edition does not list is set — a payment
 *    credential for the wrong edition is a configuration error, not something
 *    to ignore;
 *  · PRI_DISPLAY_CURRENCY is set to something other than the edition's currency.
 */
export function editionBillingProblems(edition, env = process.env) {
  const billing = editionBilling(edition);
  const set = name => String(env[name] ?? '').trim() !== '';
  const problems = [];
  for (const provider of BILLING_PROVIDERS) {
    if (billing.providers.includes(provider)) continue;
    for (const name of PROVIDER_VARIABLES[provider]) {
      if (set(name)) problems.push(`${name} must be unset (the ${billing.edition} edition does not sell through ${provider})`);
    }
  }
  const shown = String(env.PRI_DISPLAY_CURRENCY ?? '').trim().toUpperCase();
  if (shown && shown !== billing.currency) problems.push(`PRI_DISPLAY_CURRENCY must be ${billing.currency} or unset for the ${billing.edition} edition`);
  return problems;
}
