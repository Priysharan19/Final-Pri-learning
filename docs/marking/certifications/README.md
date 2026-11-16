# Examiner certification records

This directory holds **signed examiner certification records** and nothing else. Today it holds none: no examiner has
reviewed or signed anything, so method marks are **off** in both editions.

- `schema.json` — the record format (one JSON file per certification).
- A record is a transcription of a signed decision form from `docs/marking/packets/<cbse|hsc>/decision-form.md`. The
  signed original is kept by the owner; the record says who holds it and where.
- `node tools/verify-examiner-certification.mjs <record.json>` checks a record against the current packet. It is valid
  only if its dossier digest is the current one for its jurisdiction, its syllabus versions match, it names enough
  examiners (CBSE 1, NSW HSC 2) with qualification, affiliation, date and a signed independence statement, and it has a
  decision for every item and no item that does not exist. It prints the exact `PRI_METHOD_MARKS_EXAMINER_RESULT` value
  only when every item is `approved`; anything else turns nothing on.
- `node tools/verify-examiner-certification.mjs --gate` (CI, `npm run test:marking:dossier`) fails if a record here is a
  fixture, is named like a sample, or was recorded by an automation identity; if a tracked deploy file turns method marks
  on without an enabling CBSE record; or if Prithagoras leaves `UNCERTIFIED_EDITIONS` without an enabling NSW record.

**Never create a record here except from a real, signed original.** Test fixtures live in `tools/test-fixtures/`.
A CBSE record certifies CBSE only; it never enables Prithagoras (ADR-0002 §6).
