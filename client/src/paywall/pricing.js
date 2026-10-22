// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the paywall may say about price
//
// Every figure comes from the App Store product StoreKit returned. The billed
// amount is StoreKit's own `displayPrice`, shown as given. A per-month
// equivalent of the yearly plan is shown only when StoreKit also gave a
// numeric price, and only as "about" — it is a division, not a price anyone is
// charged. A saving is stated only when both plans' numeric prices are known
// in the same currency, and rounded DOWN so it never overstates.
// Nothing here holds a price constant.
// ─────────────────────────────────────────────────────────────────────────────

function numericPrice(product) {
  const n = Number(product?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function currencyOf(product) {
  const c = String(product?.currencyCode || '').toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** The two plans as the paywall shows them, from StoreKit products and the server's product ids. */
export function planOffers(products, ids) {
  const list = Array.isArray(products) ? products : [];
  const pick = id => {
    const p = id ? list.find(x => x?.id === id) : null;
    if (!p || typeof p.displayPrice !== 'string' || !p.displayPrice) return null;
    return { id: p.id, displayPrice: p.displayPrice, price: numericPrice(p), currency: currencyOf(p), product: p };
  };
  return { annual: pick(ids?.annual), monthly: pick(ids?.monthly) };
}

/** The yearly price divided by twelve, rounded to a whole unit; null without a numeric price. */
export function perMonthEquivalent(annual) {
  const price = numericPrice(annual);
  return price == null ? null : Math.ceil(price / 12);
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
  return per == null ? null : formatAmount(per, currencyOf(annual), locale);
}

/**
 * The true saving of the yearly plan against twelve monthly payments, as a
 * whole percentage rounded down; null unless both numeric prices are known in
 * the same currency and the yearly plan really is cheaper.
 */
export function yearlySavingPercent(annual, monthly) {
  const a = numericPrice(annual), m = numericPrice(monthly);
  if (a == null || m == null) return null;
  if (currencyOf(annual) !== currencyOf(monthly) || !currencyOf(annual)) return null;
  const pct = Math.floor((1 - a / (12 * m)) * 100);
  return pct > 0 ? pct : null;
}
