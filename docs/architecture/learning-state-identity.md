# Learning-state content identity and expiry

Status: in force from mission `m-finish-11-learning-state` (PR for #689, #690, #691). Owner: platform. Reviewer overlays: security, reliability, qa-release.

This is the contract behind `server/platform/contentSeen.js`: how the server decides that a question an account is issued is **the same content** it has already been shown the solution of (a *repeat*, which is marked exactly like new work and earns no progress) or has already **spent a try** on, and how long those records live. Nothing in this file changes a mark. The deterministic marker never reads these records.

## 1. What is recorded, and where

One table, `idempotency_keys`, scope `practice-content`, one row per `(account_id, key)`. A row holds no content: every key is an HMAC under the server's content key (`practiceContentKey()`), so a reader of the table learns nothing about the question, its seed or its answer, and a device cannot compute a key.

| Record | Written by | Lives |
|---|---|---|
| seen (`seen-c2:<32 hex>`) | practice reveal, practice resolution, examination finalise (every item, alternative, part and part alternative on the paper) | 5 years |
| spent try (`tried-c2:<32 hex>`) | a wrong first try in practice on content that is not already a repeat | 90 days (the life of the sealed question) |

Both are read by practice issue, practice submit, the notebook twin, the History repeat and examination finalise, through `contentSeen.js` alone. Neither practice nor the examination router computes a key of its own.

## 2. The canonical identity (version 2)

`contentIdentityOf(item)` is a keyed digest (`identity:v2:` + substance) of what a student would call the question. The substance of one unit, applied recursively to the unit's alternative and to each of its parts, is:

- stem, prompt, answer form;
- the option texts as a **set** (sorted), never their dealt order;
- the keyed answer: for a multiple-choice item the **text** of the keyed option; for a multiple-correct item the **sorted set of texts** of the keyed options (so `[0, 2]` and `[2, 0]` over one deal, and any deal of the same texts, are one item, while the same indices over a different text set are not); for anything else the keyed value itself. A key that does not point at the options it is given is not canonicalised: it stays its raw self;
- `answerPrefix` and `answerSuffix` (the labels on the answer box — ₹ against $, m against m²; `checker-core.js` reads both);
- the figure, unless the generator marks the question `identityIgnoresFigure` (the prompt alone fixes the answer);
- a matching list's two sides, each with its rows in **label** order when every label on that side is distinct, in dealt order otherwise (fail closed);
- the alternative (`alt`), recursively;
- each part, recursively — so a part's own figure, stem, lists, labels and alternative are all in.

Whitespace is normalised; nothing else is. Two items with equal identities are treated as the same question everywhere learning state is read.

What this fixes, confirmed on `a5778a319` before the change: 24 deals of one multiple-correct item had 6 identities (#689); a part's alternative, a part's figure, a part's lists, a part's stem and the item's own alternative were outside the identity (#690); the labels on the answer box were outside it (#690, Agent 2 cycles 225–226); 36 row orders of a matching-list item had 36 identities (#689 comment).

What this does **not** change: the engine's own content hash (`client/src/engine/contentIdentity.js`, owned by math-reasoning). It remains the "as dealt" digest the device uses for its recent window and the composer uses for "one question once per paper", where each unit is hashed on its own. It is not the learning-state identity.

## 3. The compatibility rule for keys written before version 2

Before this version a record was written under up to three keys, each an exact function of the item shown: the version-1 identity (`seen-c<32 hex>`, `tried-c<32 hex>`), the opaque engine hash the item was stamped with, and the opaque engine digest of the item as it stood; an unstamped unit's stamp key fell back to its content id, then to its **prompt alone**. The version-1 identity keyed a multiple-correct item by its option indices and left out the labels, the alternative, and a part's figure, alternative, stem and lists.

The rule, in force and tested on both engines:

1. **History is never reset.** Every legacy key an item would have been recorded under is still read (`seenKeysOf`, `triedKeysOf` list them after the canonical key), so content recorded as seen or tried before version 2 stays seen or tried until its row expires. The legacy key read is byte for byte the key the previous implementation wrote; `server/test/learning-state-identity-check.mjs` proves this against a verbatim copy of the previous code over real generator questions, multipart items and composer shapes.
2. **Legacy keys are never widened.** The lookup is exact: the keys *this* item would have produced, never a family of candidates (other option orders, other index tuples). A wildcard lookup has been shown to match a different question's record and would suppress a student's genuinely new work.
3. **New rows carry the canonical key alone.** No legacy key is written any more. The collisions in the legacy projection therefore stop accruing from the deploy onwards and the legacy rows age out on their own clocks (90 days for a try, 5 years for seen).
4. **A legacy-only match is honoured, and reported where it is ambiguous.** A repeat decided on a legacy key is still a repeat: that is the conservative direction (a repeat earns no progress; it never changes a mark), and dropping it would reset history. Where the key that matched could not have told this item from another — the item is multiple-correct, has a label on its answer box, has an alternative, or has a part with its own figure, stem, lists or alternative (`legacyIdentityAmbiguous(item)`), or the key is the prompt-only alias of an unstamped unit — the decision is carried as `repeatEvidence: 'legacy'` beside `repeat: true` on the practice issue response, the grade receipt, the reveal, the notebook twin, the graded-attempt event, and on each examination result line, part and attempt. A legacy match on an item whose legacy key named it exactly (a stamped single multiple-choice or written question with no labels) carries no flag: for such items version 1 and version 2 discriminate alike.

What cannot be recovered, stated plainly: an opaque legacy row cannot say which of two items that shared a version-1 key it was written for (Agent 2 cycle 226 proved the rows are byte-identical in both worlds). No backfill is attempted from sealed questions, because a sealed question outlives or predates its legacy row unpredictably and a wrong backfill would itself be a reset. The ambiguity is represented, not resolved, and it closes as the rows expire.

Rollback note: a server rolled back to code before this version reads only legacy keys and would treat content recorded under canonical keys since the deploy as unseen. No row is lost; redeploying this version restores the reading. This is recorded so the release governor can weigh it; it is not a reason to dual-write legacy keys, which would carry the known collisions forward for five years.

## 4. Expiry is monotonic

`markSeen` renews a row with `expires_at = max(existing, new)` (a portable `CASE`, the same statement on SQLite and Postgres). A request that started earlier and committed later — practice captures `now` before it marks; a paper is marked off the request thread before its commit transaction opens — can no longer shorten what a later request already recorded, and housekeeping (`DELETE … WHERE expires_at < now`) can no longer sweep a row a later exposure should have kept. Confirmed on `a5778a319`: a T+10 d write followed by a T+1 d write cut a five-year record by nine days (#691); with the real `runHousekeeping` the shortened row was physically deleted at the earlier expiry.

Tested on both engines, in account-scoped transactions as the `pri_server` role on Postgres: reversed two- and three-writer orders, overlapping promises, chronological extension, revival of an expired row, 205 keys across the 100-key chunk boundary, account isolation, and the real housekeeping sweep at both expiries.

## 5. What a reviewer should check on a change here

- `legacyContentIdentityOf` and the legacy key list must not change: a change there resets history.
- No new write of a legacy key. No lookup that enumerates candidate keys.
- Any new student-visible field on a question (a new label, a new kind of part) belongs in the version-2 substance **and** in `legacyIdentityAmbiguous` if version 1 did not see it; a field added to the substance without bumping `IDENTITY_VERSION` changes every canonical key, which is a reset, so bump the version and extend the legacy readers instead.
- `expires_at` must stay monotonic on both engines; `learning-state-identity-check.mjs` runs on SQLite in CI's platform job and on Postgres through `run-platform-postgres.mjs`.
