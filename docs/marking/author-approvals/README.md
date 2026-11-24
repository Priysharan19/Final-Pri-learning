# Author approval records (method marks, per question type)

Owner decision, 18 November 2026: the author of the papers (Priysharan Tripathi, tutor) signs off the marking
scheme of each question type himself. This is a second tier, beside the examiner route in
`docs/marking/certifications/`, which is unchanged and stays the stronger one (two independent examiners).

Owner decision, 24 November 2026: for the Australian edition (Prithagoras) only, this tier now pays step marks. A
question type with a valid approved record here is paid by its scheme, without waiting for two independent NSW
examiners, while `PRI_METHOD_MARKS=on` is set on the server. India (Priyabhata) is unchanged and keeps the examiner
rule. This tier is never called examiner-certified, and the examiner folder and variable are not used for it.

This folder holds **one record per question type the author has actually reviewed**, and nothing else. Today it
holds seven, filed by the author himself on 24 November 2026, one for each of the seven question types in
`owner-review/method-marks/types.json`, each at the digest he read. No criterion is paid or shown until the Australian
server also has `PRI_METHOD_MARKS=on`, so no student sees a per-criterion mark yet.

- `schema.json` is the record format.
- A record is written by the author, after reading the packet for that type in `owner-review/method-marks/`.
  Never create a record for him, from a fixture, or from an automated run. `node tools/author-approvals.mjs --gate`
  (part of `npm run test:author:approvals`) fails on a fixture, a sample name or an automation name.
- A record names the type, the scheme digest it applies to, his verdict (`approved` or `changes-needed`), a note,
  his name (exactly "Priysharan Tripathi"; any other name is refused), the date. It counts only while the type's digest in `owner-review/method-marks/types.json` is still
  the digest in the record. Any change to the scheme or its sample questions changes the digest, and the type is
  then **not approved** again until he re-reviews it.
- `node tools/author-approvals.mjs` writes `client/src/engine/authorApprovals.js` (the page reads it at build time)
  and `server/platform/authorApproved.generated.js` (the server's list: type and digest only) from the records that
  still match. Neither list is edited by hand. `--check` fails when either file is out of date.
- Labelling. Wherever an approved type's criteria are shown, the page says "Pri practice marking, approved by the
  author (Priysharan Tripathi, tutor). Not an official NESA guideline." It never says examiner-certified or NESA.
- Approving a type here does **not** turn method marks on by itself. The Australian server pays an approved
  type's scheme only while `PRI_METHOD_MARKS=on` is set (unset, off or misspelt is the final answer only; no client
  field can set it), on a question stamped with that scheme at issue, at the digest in the record. The general
  method rubric still pays nothing in Australia, and every other Australian question stays on the final answer.
  The examiner rule (`markingPolicy.js`, `PRI_METHOD_MARKS_EXAMINER_RESULT`, `docs/marking/certifications/`) is
  unchanged and still governs India.

## The generic rule (one more approval id)

Besides the question types, the author may approve ONE generic rule that pays step marks drawn from each question's own authored worked solution
(`server/platform/genericSteps.js`, packet `owner-review/method-marks/generic-solution-steps.md`). Its approval id is `generic-solution-steps`; a record
for it is the same kind of file, `generic-solution-steps.json`, written by the author himself, naming the rule's digest. Its digest is computed over the
rule's own code and wording (not from `types.json`), so any edit to the rule revokes an approval, and the seven type digests do not depend on it.
There is no record for it today: it is a draft and pays nothing. Everything above about gates, labelling and `PRI_METHOD_MARKS=on` applies to it unchanged.

