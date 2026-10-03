// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the operator's view of a deployment
//
// Configuration flags (never values), counts (never identifiers) and the last
// housekeeping pass. /v1/health answers this only to the holder of
// PRI_METRICS_TOKEN; /v1/admin/health answers it to an admin session. The
// anonymous /v1/health carries none of it: which providers a deployment has
// wired up and how deep its queues are is reconnaissance, not liveness.
// ─────────────────────────────────────────────────────────────────────────────
import { compatibilityStatus } from './clientCompatibility.js';
import { googleNotificationBacklog } from './googleBilling.js';
import { platformConfigStatus } from './config.js';
import { housekeepingStatus } from './housekeeping.js';

/**
 * The operator's view of the deployment: configuration flags (never values),
 * counts (never identifiers) and the last housekeeping pass. Served on
 * /v1/health to PRI_METRICS_TOKEN and on /v1/admin/health to an admin session.
 */
export async function operatorHealthDetail(db, { reachable = true, housekeeping = undefined } = {}) {
  const config = platformConfigStatus();
  return {
    // The active shell floors and how many requests they turned away (CP-11).
    clientCompatibility: compatibilityStatus(),
    storage: { persistentDatabase: config.persistentDatabaseConfigured },
    identityProviders: { google: config.googleConfigured, apple: config.appleConfigured },
    authDelivery: { email: config.authEmailProviderConfigured },
    staffMfa: { keyConfigured: config.mfaKeyConfigured },
    billingProviders: {
      web: config.webBillingProviderConfigured,
      apple: config.appleBillingProviderConfigured,
      google: config.googleBillingProviderConfigured
    },
    // Counts only (no tokens): queued Google notifications and the ones that
    // keep failing, so a Play outage or a stuck refund is visible.
    googleNotifications: config.googleBillingProviderConfigured && reachable ? await googleNotificationBacklog(db) : null,
    housekeeping: housekeeping === undefined ? (reachable ? await housekeepingStatus(db) : null) : housekeeping
  };
}

