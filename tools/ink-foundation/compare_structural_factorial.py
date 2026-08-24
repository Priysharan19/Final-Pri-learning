#!/usr/bin/env python3
"""Combine two same-base Pri Ink V4 relation A/B reports into a 2x2 factorial.

Inputs are produced by evaluate_group_relations.py on the exact same frozen base,
group-relation checkpoint, split and decoder:
  report A: component validity disabled -> baseline vs pooled-relations-only
  report B: component validity enabled  -> validity-only vs combined candidate

The comparator refuses evidence/search mismatches. It never promotes a model and
reports interactions/regressions rather than hiding them.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


METRICS = (
    "exactExpressionAccuracy",
    "characterErrorRate",
    "criticalStructureExact",
    "coverage",
    "safePrecision",
    "meanDecisionConfidence",
    "worstWriterExact",
)
LOWER_IS_BETTER = {"characterErrorRate"}


def _require_equal(a: dict, b: dict, key: str):
    if a.get(key) != b.get(key):
        raise ValueError(f"factorial evidence mismatch for {key}: {a.get(key)!r} != {b.get(key)!r}")


def _delta(left: dict, right: dict) -> dict:
    return {metric: float(right.get(metric, 0.0)) - float(left.get(metric, 0.0)) for metric in METRICS}


def _regressions(baseline: dict, candidate: dict) -> list[str]:
    rows = []
    for metric in METRICS:
        before = float(baseline.get(metric, 0.0))
        after = float(candidate.get(metric, 0.0))
        if metric in LOWER_IS_BETTER:
            if after > before:
                rows.append(metric)
        elif metric != "coverage" and after < before:
            rows.append(metric)
    return rows


def build_factorial_report(no_validity: dict, with_validity: dict) -> dict:
    for report in (no_validity, with_validity):
        if report.get("productionReady") is not False:
            raise ValueError("factorial inputs must be research-only reports")
        if report.get("comparison") != "root-stroke-relations-vs-pooled-group-relations":
            raise ValueError("factorial inputs are not pooled relation A/B reports")
        expression = report.get("expression") or {}
        if not isinstance(expression.get("before"), dict) or not isinstance(expression.get("after"), dict):
            raise ValueError("factorial input is missing before/after expression metrics")

    for key in (
        "baseCheckpointSha256",
        "groupRelationCheckpointSha256",
        "groupRelationVersion",
        "groupRelationDecoder",
        "groupRelationStage",
        "decoder",
        "validationProtocol",
        "actualSearchRegimes",
    ):
        _require_equal(no_validity, with_validity, key)

    if no_validity.get("componentValidity") is not None:
        raise ValueError("first factorial report must have component validity disabled")
    validity = with_validity.get("componentValidity")
    if not isinstance(validity, dict):
        raise ValueError("second factorial report must have component validity enabled")

    a = no_validity["expression"]["before"]
    c = no_validity["expression"]["after"]
    b = with_validity["expression"]["before"]
    d = with_validity["expression"]["after"]
    sample_counts = {int(x.get("samples", -1)) for x in (a, b, c, d)}
    if len(sample_counts) != 1 or next(iter(sample_counts)) < 1:
        raise ValueError(f"factorial sample mismatch: {sorted(sample_counts)}")
    for variant in (b, c, d):
        if variant.get("writerExact") != a.get("writerExact") and False:
            # Writer metrics may legitimately change; this branch documents that
            # they are not evidence identity fields.
            raise AssertionError("unreachable")

    interaction = {}
    for metric in METRICS:
        av = float(a.get(metric, 0.0))
        bv = float(b.get(metric, 0.0))
        cv = float(c.get(metric, 0.0))
        dv = float(d.get(metric, 0.0))
        interaction[metric] = dv - cv - bv + av

    return {
        "architectureVersion": 4,
        "comparison": "joint-validity-x-pooled-relations-factorial",
        "productionReady": False,
        "baseCheckpointSha256": no_validity["baseCheckpointSha256"],
        "groupRelationCheckpointSha256": no_validity["groupRelationCheckpointSha256"],
        "groupRelationVersion": no_validity["groupRelationVersion"],
        "decoder": no_validity["decoder"],
        "componentValidity": validity,
        "validationProtocol": no_validity["validationProtocol"],
        "actualSearchRegimes": no_validity.get("actualSearchRegimes") or {},
        "variants": {
            "baseline": a,
            "validityOnly": b,
            "pooledRelationsOnly": c,
            "combined": d,
        },
        "effects": {
            "validityOnlyMinusBaseline": _delta(a, b),
            "pooledRelationsOnlyMinusBaseline": _delta(a, c),
            "combinedMinusBaseline": _delta(a, d),
            "interaction": interaction,
        },
        "combinedRegressions": _regressions(a, d),
        "evidence": (
            "research-only exact-same-base 2x2 diagnostic; synthetic and same-writer results "
            "are not production handwriting evidence"
        ),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("no_validity_report")
    p.add_argument("with_validity_report")
    p.add_argument("--out", required=True)
    args = p.parse_args()
    no_validity = json.loads(Path(args.no_validity_report).read_text())
    with_validity = json.loads(Path(args.with_validity_report).read_text())
    try:
        report = build_factorial_report(no_validity, with_validity)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n")

    variants = report["variants"]
    print("\nPri Ink Structural V4 — VALIDITY × POOLED RELATIONS FACTORIAL\n")
    for name in ("baseline", "validityOnly", "pooledRelationsOnly", "combined"):
        row = variants[name]
        print(
            f"{name}: exact={100*row.get('exactExpressionAccuracy', 0):.2f}% "
            f"CER={100*row.get('characterErrorRate', 0):.2f}% "
            f"safe={100*row.get('safePrecision', 0):.2f}% "
            f"coverage={100*row.get('coverage', 0):.2f}%"
        )
    print("combined regressions: " + (", ".join(report["combinedRegressions"]) or "none in guarded metrics"))
    print("production ready: false")
    print(f"report: {out}")


if __name__ == "__main__":
    main()
