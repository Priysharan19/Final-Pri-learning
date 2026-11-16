// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging test mailbox: whether it is on, and for whom
//
// The real-staging journey needs a verified email (practice requires one), and
// a person should not have to make an inbox for every run. So on STAGING ONLY,
// email to one reserved, undeliverable domain is not sent: it is kept in a
// short-lived mailbox the harness can read (testMailbox.js). Every other
// address is sent exactly as before, so real delivery stays tested.
//
// WHICH ADDRESSES. Only `<local>@e2e.prilearning.test`. `.test` is reserved by
// RFC 2606 / RFC 6761 and never resolves, so no real person can own one of
// these addresses: an account made with one is synthetic by definition, and
// verifying it proves the flow, not that mail reaches anybody.
//
// WHEN IT IS ON. Decided from the environment the platform already injects, so
// nobody sets anything:
//   · RAILWAY_ENVIRONMENT_NAME is Railway's own name for the environment a
//     deployment runs in ("The environment name of the service instance",
//     provided to every build and deployment: docs.railway.com/reference/
//     variables). This project's two environments are `staging` and
//     `production` (docs/release/production-cutover-checklist.md).
//   · ON when it is exactly `staging`, or in the test harness (NODE_ENV=test
//     with no Railway variable at all: config.js already refuses to boot a
//     Railway deployment in test mode).
//   · HARD-OFF, whatever else is set, when RAILWAY_ENVIRONMENT_NAME is
//     `production`, when PRI_PUBLIC_ORIGIN is a prilearning.com origin (the
//     production app and site, decision D5), or when PRI_TEST_MAILBOX=off.
//   · OFF everywhere else: an unset or unknown environment is never staging.
//
// No imports: tools/production-preflight.mjs reads this file to refuse a
// production configuration under which the mailbox would be on.
// ─────────────────────────────────────────────────────────────────────────────

/** The one reserved domain whose mail is kept instead of sent. */
export const TEST_MAILBOX_DOMAIN = 'e2e.prilearning.test';

const trim = value => String(value ?? '').trim();

/** Is this a production origin (prilearning.com or any subdomain of it)? */
export function isProductionOrigin(origin) {
  const text = trim(origin);
  if (!text) return false;
  let host;
  try { host = new URL(text).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  return host === 'prilearning.com' || host.endsWith('.prilearning.com');
}

/**
 * { on, reason } for this environment. `reason` names the rule that decided,
 * for tests and operator tooling only; /v1/ready reports just on or off.
 */
export function testMailboxState(env = process.env) {
  const railway = trim(env.RAILWAY_ENVIRONMENT_NAME).toLowerCase();
  if (trim(env.PRI_TEST_MAILBOX).toLowerCase() === 'off') return { on: false, reason: 'switched-off' };
  if (railway === 'production') return { on: false, reason: 'production-environment' };
  if (isProductionOrigin(env.PRI_PUBLIC_ORIGIN)) return { on: false, reason: 'production-origin' };
  if (railway === 'staging') return { on: true, reason: 'staging' };
  const anyRailway = !!(railway || trim(env.RAILWAY_ENVIRONMENT) || trim(env.RAILWAY_ENVIRONMENT_ID) || trim(env.RAILWAY_DEPLOYMENT_ID));
  if (!anyRailway && trim(env.NODE_ENV) === 'test') return { on: true, reason: 'test-harness' };
  return { on: false, reason: railway ? 'not-staging' : 'no-environment' };
}

export const testMailboxEnabled = (env = process.env) => testMailboxState(env).on;

/** A reserved test address: a plain local part at exactly the reserved domain. */
export function isTestMailboxAddress(address) {
  const value = trim(address).toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0) return false;
  return value.slice(at + 1) === TEST_MAILBOX_DOMAIN && /^[a-z0-9][a-z0-9._+-]{0,63}$/.test(value.slice(0, at));
}

/** Is mail to `address` kept in the mailbox (rather than sent) in this environment? */
export const testMailboxAccepts = (env, address) => testMailboxEnabled(env) && isTestMailboxAddress(address);
