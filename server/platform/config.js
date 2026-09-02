function nonEmpty(name) {
  return !!String(process.env[name] || '').trim();
}

export function platformConfigStatus() {
  const production = process.env.NODE_ENV === 'production';
  const missing = [];
  if (production && !nonEmpty('PRI_PUBLIC_ORIGIN')) missing.push('PRI_PUBLIC_ORIGIN');
  if (production && !nonEmpty('PRI_CSRF_SECRET')) missing.push('PRI_CSRF_SECRET');
  if (production && !nonEmpty('PRI_AUTH_DELIVERY_KEY')) missing.push('PRI_AUTH_DELIVERY_KEY');
  return Object.freeze({
    production,
    missing: Object.freeze(missing),
    ok: missing.length === 0,
    googleConfigured: nonEmpty('PRI_GOOGLE_CLIENT_IDS'),
    appleConfigured: nonEmpty('PRI_APPLE_CLIENT_IDS'),
    appleBillingProductsConfigured: nonEmpty('PRI_APPLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_APPLE_ANNUAL_PRODUCT_ID'),
    googleBillingProductsConfigured: nonEmpty('PRI_GOOGLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_GOOGLE_ANNUAL_PRODUCT_ID'),
    webBillingProductsConfigured: nonEmpty('PRI_WEB_MONTHLY_PRICE_ID') || nonEmpty('PRI_WEB_ANNUAL_PRICE_ID')
  });
}

export function assertPlatformConfig() {
  const status = platformConfigStatus();
  if (!status.ok) throw new Error(`Pri Learning production platform configuration is incomplete: ${status.missing.join(', ')}`);
  if (status.production) {
    let origin;
    try { origin = new URL(process.env.PRI_PUBLIC_ORIGIN); } catch { throw new Error('PRI_PUBLIC_ORIGIN is invalid'); }
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) throw new Error('PRI_PUBLIC_ORIGIN must be a clean HTTPS origin in production');
  }
  return status;
}
