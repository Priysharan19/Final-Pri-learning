// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay
// Extra structural forms for Australian skills (Standard 2, Years 7–10). Each
// entry names an existing generator and lists variants; the wrapped generator
// picks between the original and its variants from the seed's own rng, so a
// seed still reproduces its question exactly. Variants are deterministic and
// engine-keyed like any other generator; AI never sets a key.
//   forms = { 'y9-pythagoras': [ { diffs: [2, 3], make: (rng, diff) => payload }, … ] }
// ─────────────────────────────────────────────────────────────────────────────
export function applyAuForms(bank, forms) {
  const out = { ...bank };
  for (const [id, variants] of Object.entries(forms)) {
    const base = bank[id];
    if (typeof base !== 'function') continue;   // the skill lives in another bank
    const wrapped = (rng, diff) => {
      const pool = [null, ...variants.filter(v => !v.diffs || v.diffs.includes(diff))];
      const pick = pool[Math.floor(rng() * pool.length)];
      return pick ? pick.make(rng, diff) : base(rng, diff);
    };
    Object.assign(wrapped, base);   // keep per-difficulty dot-point declarations
    wrapped.direct = base;          // the skill's established form on its own (tests pin seeds against it)
    out[id] = wrapped;
  }
  return out;
}
