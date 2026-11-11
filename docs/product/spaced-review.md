# Spaced review schedule (F5)

Engine: `client/src/engine/spacedReview.js`. It is served by `GET /v1/practice/review-queue` as `spaced`, computed on every read from this account's server-marked attempts. The server is authoritative, and every device reads the same schedule. Nothing is stored on a device.

| Parameter | Value | Meaning |
|---|---|---|
| `LADDER_DAYS` | 1, 2, 4, 7, 14, 30, 60 | Days until the next review, one value per rung |
| Start | rung 0 | An item's first attempt places it on rung 0 (1 day) |
| Correct recall | +1 rung | Counts only when unassisted and made after at least `EARLY_SHARE` (0.5) of the current interval |
| Early correct | hold | Too soon to test memory |
| Correct with hints | hold | |
| Miss or reveal | −`MISS_DROP` (2) rungs | Never below rung 0 |
| Due | `lastAt + LADDER_DAYS[rung]` ≤ now | "Due today" is every item past its due time |

These values are a bounded product choice, not a research-derived optimum. No retention or learning-outcome claim rests on them. Tests: `client/test/spaced-review-check.mjs`.
