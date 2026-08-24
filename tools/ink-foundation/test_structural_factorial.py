#!/usr/bin/env python3
"""Deterministic contracts for the Pri Ink V4 2x2 candidate comparator."""
from __future__ import annotations

import sys

sys.path.insert(0, "tools/ink-foundation")

from compare_structural_factorial import build_factorial_report


def _metrics(exact, cer, safe, coverage):
    return {
        "samples": 10,
        "exactExpressionAccuracy": exact,
        "characterErrorRate": cer,
        "criticalStructureExact": exact,
        "coverage": coverage,
        "safePrecision": safe,
        "meanDecisionConfidence": 0.50,
        "worstWriterExact": exact,
        "writerExact": {"W": exact},
    }


def _report(validity, before, after):
    return {
        "comparison": "root-stroke-relations-vs-pooled-group-relations",
        "productionReady": False,
        "baseCheckpointSha256": "base-sha",
        "groupRelationCheckpointSha256": "rel-sha",
        "groupRelationVersion": 2,
        "groupRelationDecoder": "pooled-group-relations-v2",
        "groupRelationStage": "group-relation-research",
        "decoder": "joint-auto",
        "componentValidity": validity,
        "validationProtocol": {"protocol": "writer-disjoint", "writerDisjoint": True, "productionEvidence": False},
        "actualSearchRegimes": {"joint-auto-v1:general": 10},
        "expression": {"before": before, "after": after},
    }


def test_factorial_recovers_four_variants_and_interaction():
    a = _metrics(0.40, 0.20, 0.95, 0.80)
    b = _metrics(0.45, 0.18, 0.97, 0.75)
    c = _metrics(0.50, 0.16, 0.96, 0.78)
    d = _metrics(0.60, 0.10, 0.99, 0.72)
    report = build_factorial_report(
        _report(None, a, c),
        _report({"checkpointSha256": "validity-sha", "version": 2}, b, d),
    )
    assert report["variants"]["baseline"] is a
    assert report["variants"]["validityOnly"] is b
    assert report["variants"]["pooledRelationsOnly"] is c
    assert report["variants"]["combined"] is d
    expected_exact_interaction = 0.60 - 0.50 - 0.45 + 0.40
    assert abs(report["effects"]["interaction"]["exactExpressionAccuracy"] - expected_exact_interaction) < 1e-12
    assert report["combinedRegressions"] == []
    assert report["productionReady"] is False


def test_factorial_refuses_evidence_mismatch():
    a = _metrics(0.4, 0.2, 0.9, 0.8)
    left = _report(None, a, a)
    right = _report({"checkpointSha256": "v", "version": 2}, a, a)
    right["baseCheckpointSha256"] = "other-base"
    try:
        build_factorial_report(left, right)
    except ValueError as exc:
        assert "baseCheckpointSha256" in str(exc)
    else:
        raise AssertionError("factorial comparator accepted different base checkpoints")


def main():
    test_factorial_recovers_four_variants_and_interaction()
    test_factorial_refuses_evidence_mismatch()
    print("Pri Ink V4 factorial comparator: 2/2 deterministic contracts PASS")


if __name__ == "__main__":
    main()
