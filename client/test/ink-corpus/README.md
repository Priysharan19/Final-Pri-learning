# Real handwriting corpus

Drop `ink-corpus-*.json` files here, recorded with `tools/ink-collect/index.html`.

Nothing in this directory is generated. Every file is handwriting a real person
produced with a Pencil, and it is the only evidence in this repo that the
recogniser works on hands other than the one the generator simulates.

Run `npm run test:real` to score against it.

Guidance:
- 8+ writers before the number is quotable as a product claim.
- Keep finger-written corpora — the suite reports them separately rather than
  mixing them into the pencil figure.
- Do not tune the recogniser against this set. Record a second corpus and hold
  it back, the same way `inkcheck-holdout2.mjs` is held back from the tuning suites.
