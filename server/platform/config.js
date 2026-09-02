function nonEmpty(name) {
  return !!String(process.env[name] || '').trim();
}

function webMonthlyConfigured() {
  return nonEmpty('PRI_RAZORPAY_MONTHLY_PLAN_ID') || nonEmpty('PRI_WEB_MONTHLY_PRICE_ID');
}

function webAnnualConfigured() {
  return nonEmpty('PRI_RAZORPAY_ANNUAL_PLAN_ID') || nonEmpty('PRI_WEB_ANNUAL_PRICE_ID');
}

function appleTrustConfigured() {
  return nonEmpty('PRI_APPLE_ROOT_CA_PEM') || nonEmpty('PRI_APPLE_ROOT_CA_FILE');
}

export function platformConfigStatus() {
  const production = process.env.NODE_ENV === 'production';
  const missing = [];
  if (production && !nonEmpty('PRI_PUBLIC_ORIGIN')) missing.push('PRI_PUBLIC_ORIGIN');
  if (production && !nonEmpty('PRI_CSRF_SECRET')) missing.push('PRI_CSRF_SECRET');
  if (production && !nonEmpty('PRI_AUTH_DELIVERY_KEY')) missing.push('PRI_AUTH_DELIVERY_KEY');

  const webMonthly = webMonthlyConfigured();
  const webAnnual = webAnnualConfigured();
  const webProducts = webMonthly || webAnnual;
  if (production && webProducts) {
    for (const name of ['PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET']) {
      if (!nonEmpty(name)) missing.push(name);
    }
    if (webMonthly && !nonEmpty('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT')) missing.push('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT');
    if (webAnnual && !nonEmpty('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT')) missing.push('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT');
  }

  const appleProducts = nonEmpty('PRI_APPLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_APPLE_ANNUAL_PRODUCT_ID');
  if (production && appleProducts) {
    if (!appleTrustConfigured()) missing.push('PRI_APPLE_ROOT_CA_PEM or PRI_APPLE_ROOT_CA_FILE');
    if (!nonEmpty('PRI_APPLE_APP_ID')) missing.push('PRI_APPLE_APP_ID');
  }

  const webBillingProviderConfigured = webProducts &&
    nonEmpty('PRI_RAZORPAY_KEY_ID') && nonEmpty('PRI_RAZORPAY_KEY_SECRET') && nonEmpty('PRI_RAZORPAY_WEBHOOK_SECRET') &&
    (!webMonthly || nonEmpty('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT')) &&
    (!webAnnual || nonEmpty('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT'));
  const appleBillingProviderConfigured = appleProducts && appleTrustConfigured() &&
    (!production || nonEmpty('PRI_APPLE_APP_ID'));

  const uniqueMissing = [...new Set(missing)];
  return Object.freeze({
    production,
    missing: Object.freeze(uniqueMissing),
    ok: uniqueMissing.length === 0,
    googleConfigured: nonEmpty('PRI_GOOGLE_CLIENT_IDS'),
    appleConfigured: nonEmpty('PRI_APPLE_CLIENT_IDS'),
    appleBillingProductsConfigured: appleProducts,
    appleBillingProviderConfigured,
    googleBillingProductsConfigured: nonEmpty('PRI_GOOGLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_GOOGLE_ANNUAL_PRODUCT_ID'),
    webBillingProductsConfigured: webProducts,
    webBillingProviderConfigured
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
