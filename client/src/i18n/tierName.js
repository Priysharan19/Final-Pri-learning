// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the paid tier's name in Prithagoras copy
//
// Owner decision, 19 Nov 2026: the paid tier is "HSC Pass" in Prithagoras. The shared English
// catalogue says "Premium"; a Prithagoras build renames it at lookup (i18n/core.js), so the
// catalogue, the internal capability ids (`unlimited-practice`, `advanced-analytics`, …) and
// India's copy are untouched, and no second catalogue of 70 sentences has to be kept in step.
// Counted strings ({ one, other }) are renamed value by value.
// ─────────────────────────────────────────────────────────────────────────────
export const PRITHAGORAS_TIER_NAME = 'HSC Pass';

/** A catalogue entry with the paid tier's name replaced; the same value when it names none. */
export function renameTier(entry) {
  if (typeof entry === 'string') return entry.includes('Premium') ? entry.replace(/\bPremium\b/g, PRITHAGORAS_TIER_NAME) : entry;
  if (entry && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, renameTier(v)]));
  return entry;
}
