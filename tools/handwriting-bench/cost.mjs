// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting benchmark · what each candidate costs to run
//
// Prices live here and nowhere else, so "cost per evaluation" in the report is
// one auditable table rather than a number computed differently per adapter.
//
// Every entry carries the date it was read and the page it came from. Vendor
// pricing moves; a number without a date is a number nobody can check. Re-read
// them before quoting the report to anyone, and update `CHECKED` when you do.
// ─────────────────────────────────────────────────────────────────────────────

export const CHECKED = '2026-09-07';

/** Per-request prices. Mathpix bills per call, not per token. */
export const MATHPIX = Object.freeze({
  // https://mathpix.com/pricing/api — first 1M requests.
  imagePerRequest: 0.002,
  strokesPerRequest: 0.002,
  pdfPerPage: 0.005,
  // Sessions are the live-drawing unit: one equation, any number of live
  // updates inside it. Free to 1K/month, then this. This is the number that
  // decides whether Architecture D is affordable.
  strokesSessionTier: Object.freeze([
    { upTo: 1_000, perSession: 0 },
    { upTo: 100_000, perSession: 0.01 },
    { upTo: 1_000_000, perSession: 0.008 },
    { upTo: Infinity, perSession: 0.005 }
  ]),
  oneTimeKeyActivation: 19.99,
  testingCredit: 29
});

/** Per-million-token prices for the multimodal candidates. */
export const TOKENS = Object.freeze({
  // https://platform.openai.com/docs/pricing (read via search, 2026-09-07)
  'gpt-5.6-terra': { inPerM: 2.00, outPerM: 12.00 },
  'gpt-5.6-sol': { inPerM: 2.00, outPerM: 12.00, note: 'confirm — Sol tier priced separately from Terra' },
  // https://ai.google.dev/pricing
  'gemini-2.5-pro': { inPerM: 1.25, outPerM: 10.00 },
  'gemini-2.5-flash': { inPerM: 0.15, outPerM: 1.25 },
  // Anthropic first-party rates.
  'claude-opus-5': { inPerM: 5.00, outPerM: 25.00 },
  'claude-sonnet-5': { inPerM: 2.00, outPerM: 10.00 },
  'claude-haiku-4-5': { inPerM: 1.00, outPerM: 5.00 }
});

/**
 * What one call cost, from the usage the provider actually reported.
 *
 * Returns null when the provider returned no usage — an unknown cost is
 * reported as unknown rather than estimated, because an estimated cost that
 * looks like a measurement is the kind of number that ends up in a decision.
 */
export function tokenCost(model, usage) {
  const price = TOKENS[model];
  if (!price || !usage) return null;
  const input = Number(usage.inputTokens);
  const output = Number(usage.outputTokens);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return (input / 1e6) * price.inPerM + (output / 1e6) * price.outPerM;
}

/** Per-session stroke price at a given monthly volume. */
export function strokesSessionCost(sessionsThisMonth = 0) {
  for (const tier of MATHPIX.strokesSessionTier) {
    if (sessionsThisMonth < tier.upTo) return tier.perSession;
  }
  return MATHPIX.strokesSessionTier.at(-1).perSession;
}

/** USD → AUD. One place, one date, so budget lines are reproducible. */
export const USD_TO_AUD = Object.freeze({ rate: 1.3882, asOf: '2026-09-04', source: 'RBA/market mid, via search' });
export const aud = usd => (Number(usd) || 0) * USD_TO_AUD.rate;
