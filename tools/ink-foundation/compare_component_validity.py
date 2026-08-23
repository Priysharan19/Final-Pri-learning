#!/usr/bin/env python3
"""Compare one joint V4 decoder with and without component validity.

Both reports must use the same base checkpoint, decoder, split, writer/sample set,
and frozen dev protocol. This isolates the effect of the auxiliary rejection head
instead of conflating it with a model or search-regime change.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


METRICS = (
    ("exactExpressionAccuracy", "exact expression", True),
    ("characterErrorRate", "CER", False),
    ("criticalStructureExact", "critical structure exact", True),
    ("coverage", "abstention coverage", True),
    ("safePrecision", "safe precision", True),
    ("worstWriterExact", "worst writer exact", True),
    ("meanDecisionConfidence", "mean decision confidence", True),
)


def _load(path: Path) -> dict:
    try:
        report = json.loads(path.read_text())
    except Exception as exc:
        raise SystemExit(f"cannot read report {path}: {exc}") from exc
    if int(report.get("architectureVersion", 0)) != 4:
        raise SystemExit(f"{path}: not a Pri Ink V4 report")
    if report.get("productionReady") is not False:
        raise SystemExit(f"{path}: validity comparison refuses productionReady=true")
    if report.get("decoder") not in {"joint", "joint-general", "joint-auto"}:
        raise SystemExit(f"{path}: component validity comparison requires a joint decoder")
    return report


def _same(key: str, before: dict, after: dict):
    if before.get(key) != after.get(key):
        raise SystemExit(
            f"evidence mismatch for {key}: before={before.get(key)!r} after={after.get(key)!r}"
        )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("baseline", help="joint-decoder report without component validity")
    p.add_argument("candidate", help="same joint decoder with component validity")
    p.add_argument("--out", default=None)
    args = p.parse_args()

    before = _load(Path(args.baseline))
    after = _load(Path(args.candidate))
    if before.get("componentValidity") is not None:
        raise SystemExit("baseline must not use component validity")
    validity = after.get("componentValidity")
    if not isinstance(validity, dict):
        raise SystemExit("candidate must include component validity metadata")

    for key in ("stage", "decoder", "checkpointSha256", "samples", "writers"):
        _same(key, before, after)
    if "split" in before or "split" in after:
        _same("split", before, after)
    if "validationProtocol" in before or "validationProtocol" in after:
        _same("validationProtocol", before, after)
    if validity.get("baseCheckpointSha256") != before.get("checkpointSha256"):
        raise SystemExit("component validity checkpoint is not tied to compared base checkpoint")

    before_regimes = (before.get("jointPartition") or {}).get("actualSearchRegimes")
    after_regimes = (after.get("jointPartition") or {}).get("actualSearchRegimes")
    if before_regimes != after_regimes:
        raise SystemExit(
            f"search-regime mismatch: before={before_regimes!r} after={after_regimes!r}"
        )

    deltas = {}
    regressions = []
    for key, label, higher_is_better in METRICS:
        if key not in before or key not in after:
            continue
        a = float(before[key]); b = float(after[key]); delta = b - a
        improved = delta > 0 if higher_is_better else delta < 0
        regressed = delta < 0 if higher_is_better else delta > 0
        deltas[key] = {
            "label": label,
            "withoutValidity": a,
            "withValidity": b,
            "delta": delta,
            "deltaPercentagePoints": 100.0 * delta,
            "direction": "improved" if improved else "regressed" if regressed else "unchanged",
        }
        if regressed:
            regressions.append(key)

    result = {
        "architectureVersion": 4,
        "productionReady": False,
        "comparison": "joint-without-vs-with-component-validity",
        "decoder": before.get("decoder"),
        "stage": before.get("stage"),
        "checkpointSha256": before.get("checkpointSha256"),
        "samples": before.get("samples"),
        "writers": before.get("writers"),
        "actualSearchRegimes": before_regimes,
        "componentValidity": validity,
        "deltas": deltas,
        "regressions": regressions,
        "evidence": before.get("evidence"),
        "interpretation": "auxiliary-head ablation only; production promotion remains governed by real writer-disjoint gates",
    }

    print("\nPri Ink Structural V4 — COMPONENT VALIDITY A/B\n")
    print(f"decoder: {result['decoder']} · samples: {result['samples']} · writers: {result['writers']}")
    for key, _, _ in METRICS:
        row = deltas.get(key)
        if not row:
            continue
        print(
            f"{row['label']}: {100*row['withoutValidity']:.2f}% -> "
            f"{100*row['withValidity']:.2f}% ({row['deltaPercentagePoints']:+.2f} pp, {row['direction']})"
        )
    print("regressions: " + (", ".join(regressions) if regressions else "none in reported metrics"))
    print("production ready: false")

    if args.out:
        out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2) + "\n")
        print(f"report: {out}")


if __name__ == "__main__":
    main()
