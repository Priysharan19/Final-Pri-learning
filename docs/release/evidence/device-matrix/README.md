# Physical-device matrix ledger

`results.jsonl` in this directory is the only ledger of physical-device results for
`docs/release/device-matrix.md`. It is written only by `scripts/device-matrix-record.mjs record`
(one JSON object per line, append-only) and re-checked by `scripts/device-matrix-record.mjs validate`
in `npm test`. No ledger file here yet means no physical-device result has been recorded; that is the
truthful state, not a missing file.

Every row is PHYSICAL-HUMAN evidence: a named person, a real device, its OS, the 40-hex build SHA.
Simulator, emulator and agent rows are refused by the recorder and by `validate`.
