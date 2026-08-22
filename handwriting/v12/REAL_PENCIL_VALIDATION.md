# Handwriting V12 — Real Apple Pencil Validation Pipeline

## Objective

Close the evidence gap between synthetic/simulator handwriting benchmarks and real student Apple Pencil handwriting.

## Rules

- Real writer data is consented and anonymised.
- Writers must never appear in both training and evaluation splits.
- Synthetic and real-human metrics are reported separately.
- No 100% production accuracy claim without evidence.

## Metrics

Track:

- exact expression accuracy
- character accuracy
- worst-writer accuracy
- latency
- confidence calibration
- failure taxonomy

## Dataset split

Required split keys:

- writer_id (hashed)
- session_id
- collection_device
- timestamp bucket
- expression_id

The benchmark runner must reject leakage between train, validation and test.
