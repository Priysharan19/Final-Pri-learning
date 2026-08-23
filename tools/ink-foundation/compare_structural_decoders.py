#!/usr/bin/env python3
"""Compare complete-link vs joint Pri Ink V4 reports on identical evidence.

The tool refuses apples-to-oranges comparisons: checkpoint hash, split, sample
count, writer count, stage and (for same-writer development reports) frozen split
metadata must match. It accepts only explicitly named joint decoder variants,
reports their search regime, and never turns same-writer or synthetic results into
production evidence or lowers any release threshold.
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
)


def _load(path: Path) -> dict:
    try:
        report = json.loads(path.read_text())
    except Exception as exc:
        raise SystemExit(f"cannot read report {path}: {exc}") from exc
    if int(report.get("architectureVersion", 0)) != 4:
        raise SystemExit(f"{path}: not a Pri Ink V4 report")
    if report.get("productionReady") is not False:
        raise SystemExit(f"{path}: comparison refuses a report claiming production readiness")
    return report


def _same(name: str, baseline: dict, candidate: dict):
    if baseline.get(name) != candidate.get(name):
        raise SystemExit(
            f"evidence mismatch for {name}: baseline={baseline.get(name)!r} "
            f"candidate={candidate.get(name)!r}"
        )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("baseline", help="complete-link evaluation JSON")
    p.add_argument("candidate", help="explicit joint decoder evaluation JSON")
    p.add_argument("--out", default=None)
    args = p.parse_args()

    baseline_path = Path(args.baseline)
    candidate_path = Path(args.candidate)
    baseline = _load(baseline_path)
    candidate = _load(candidate_path)

    if baseline.get("decoder", "complete-link") != "complete-link":
        raise SystemExit("baseline report must use decoder=complete-link")
    candidate_decoder = str(candidate.get("decoder", ""))
    if candidate_decoder not in {"joint", "joint-general", "joint-auto"}:
        raise SystemExit(
            "candidate report must use an explicit joint decoder: "
            "joint, joint-general, or joint-auto"
        )

    for key in ("stage", "checkpointSha256", "samples", "writers"):
        _same(key, baseline, candidate)
    if "split" in baseline or "split" in candidate:
        _same("split", baseline, candidate)
    if "validationProtocol" in baseline or "validationProtocol" in candidate:
        _same("validationProtocol", baseline, candidate)

    deltas = {}
    regressions = []
    for key, label, higher_is_better in METRICS:
        if key not in baseline or key not in candidate:
            continue
        before = float(baseline[key])
        after = float(candidate[key])
        delta = after - before
        improved = delta > 0 if higher_is_better else delta < 0
        regressed = delta < 0 if higher_is_better else delta > 0
        deltas[key] = {
            "label": label,
            "baseline": before,
            "joint": after,
            "delta": delta,
            "deltaPercentagePoints": 100.0 * delta,
            "direction": "improved" if improved else "regressed" if regressed else "unchanged",
        }
        if regressed:
            regressions.append(key)

    result = {
        "architectureVersion": 4,
        "productionReady": False,
        "comparison": f"complete-link-vs-{candidate_decoder}",
        "candidateDecoder": candidate_decoder,
        "stage": baseline.get("stage"),
        "checkpointSha256": baseline.get("checkpointSha256"),
        "split": baseline.get("split"),
        "samples": baseline.get("samples"),
        "writers": baseline.get("writers"),
        "deltas": deltas,
        "regressions": regressions,
        "candidateJointPartition": candidate.get("jointPartition"),
        "evidence": baseline.get("evidence"),
        "interpretation": "comparison only; release promotion remains governed by writer-disjoint production gates",
    }

    print("\nPri Ink Structural V4 — DECODER COMPARISON\n")
    print(f"candidate decoder: {candidate_decoder}")
    print(f"stage: {result['stage']} · samples: {result['samples']} · writers: {result['writers']}")
    for key, _, _ in METRICS:
        row = deltas.get(key)
        if not row:
            continue
        print(
            f"{row['label']}: {100*row['baseline']:.2f}% -> {100*row['joint']:.2f}% "
            f"({row['deltaPercentagePoints']:+.2f} pp, {row['direction']})"
        )
    if regressions:
        print("regressions: " + ", ".join(regressions))
    else:
        print("regressions: none in reported metrics")
    print("production ready: false")

    if args.out:
        out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2) + "\n")
        print(f"report: {out}")


if __name__ == "__main__":
    main()
