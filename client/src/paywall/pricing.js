// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the Premium screen may say about price
//
// Every figure comes from the store's own product: StoreKit on Apple, Google
// Play's product details on Android. The billed amount is the store's own
// `displayPrice`, shown as given. A per-month equivalent of the yearly plan is
// shown only when the store also gave a numeric price, only as "about", and
// rounded UP — it is a division, not a price anyone is charged. A saving is
// stated only when both plans' numeric prices are known in the same currency,
// and rounded DOWN so it never overstates. Nothing here holds a price constant.
// ─────────────────────────────────────────────────────────────────────────────

/** The store's numeric price: Apple's `price` (a decimal string), or Google's micros. */
export function numericPrice(product) {
  if (product?.price != null && product.price !== '') {
    const n = Number(product.price);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const micros = Number(product?.priceMicros);
  return Number.isSafeInteger(micros) && micros > 0 ? micros / 1e6 : null;
}

export function currencyOf(product) {
  const c = String(product?.currencyCode || product?.currency || '').toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/**
 * The two plans as the screen shows them. `products` are the store's, `ids`
 * the server's: { monthly, annual }, each a product id (Apple) or
 * { productId, basePlanId } (Google). A plan the store did not return, or
 * returned without a display price, is not offered.
 */
export function planOffers(products, ids) {
  const list = Array.isArray(products) ? products : [];
  const pick = want => {
    if (!want) return null;
    const productId = typeof want === 'string' ? want : want.productId;
    const basePlanId = typeof want === 'string' ? null : want.basePlanId || null;
    const p = list.find(x => x?.id === productId && (!basePlanId || x.basePlanId === basePlanId)) || null;
    if (!p || typeof p.displayPrice !== 'string' || !p.displayPrice) return null;
    return { id: p.id, basePlanId: p.basePlanId || null, displayPrice: p.displayPrice, price: numericPrice(p), currency: currencyOf(p), product: p };
  };
  return { annual: pick(ids?.annual), monthly: pick(ids?.monthly) };
}

/** The yearly price divided by twelve, rounded up to a whole unit; null without a numeric price. */
export function perMonthEquivalent(annual) {
  const price = annual?.price ?? numericPrice(annual);
  return Number.isFinite(price) && price > 0 ? Math.ceil(price / 12) : null;
}

/** A whole-unit amount in the product's currency; null when it cannot be said. */
export function formatAmount(amount, currency, locale = 'en-IN') {
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
  } catch { return null; }
}

/** The per-month line for the yearly plan, or null when no numeric price was given. */
export function aboutPerMonth(annual, locale) {
  const per = perMonthEquivalent(annual);
  return per == null ? null : formatAmount(per, annual?.currency ?? currencyOf(annual), locale);
}

/**
 * The true saving of the yearly plan against twelve monthly payments, as a
 * whole percentage rounded down; null unless both numeric prices are known in
 * the same currency and the yearly plan really is cheaper.
 */
export function yearlySavingPercent(annual, monthly) {
  const a = annual?.price ?? numericPrice(annual);
  const m = monthly?.price ?? numericPrice(monthly);
  if (!(a > 0) || !(m > 0)) return null;
  const ca = annual?.currency ?? currencyOf(annual);
  const cm = monthly?.currency ?? currencyOf(monthly);
  if (!ca || ca !== cm) return null;
  const pct = Math.floor((1 - a / (12 * m)) * 100);
  return pct > 0 ? pct : null;
}
