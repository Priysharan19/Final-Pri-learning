# Physical-device matrix ledger

`results.jsonl` in this directory is the only ledger of physical-device case results for
`docs/release/device-matrix.md`, and `soak.jsonl` the only ledger of soak records. They are written only
by `scripts/device-matrix-record.mjs record` and `scripts/device-matrix-record.mjs soak` (one JSON object
per line, append-only) and re-checked by `scripts/device-matrix-record.mjs validate` in `npm test`. No
ledger file here yet means no physical-device result has been recorded; that is the truthful state, not
a missing file. Every row names the build kind (development build on staging, or store build on
production) so the two kinds of run are never merged into one verdict.

Every row is PHYSICAL-HUMAN evidence: a named person, a real device, its OS, the 40-hex build SHA.
Simulator, emulator and agent rows are refused by the recorder and by `validate`.
